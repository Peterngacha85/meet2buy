import { Order } from '../models/Commerce.js';
import { Store } from '../models/Store.js';
import { User } from '../models/User.js';
import { nextSeq } from '../models/Counter.js';
import { ACTIVE_TICKET, SupportTicket } from '../models/SupportTicket.js';
import { AppError } from '../utils/AppError.js';
import { notifyAdmins, notifyStoreOwner, notifyUser } from './notifyService.js';
import { RECEIPTED } from './receiptService.js';

// After-sales service: buyer ⇄ seller, with Meet2buy stepping in when asked (Terms §7).
// Messages are not masked like room chat: both sides already have each other's phone once an order is
// paid, and warranty claims need IMEI and serial numbers.

export const CATEGORY_LABEL = {
  not_delivered: 'Not delivered',
  faulty: 'Faulty / not working',
  damaged: 'Arrived damaged',
  wrong_item: 'Wrong item',
  warranty: 'Warranty / repair',
  refund_return: 'Return or refund',
  other: 'Something else',
};

/** Who is looking at a ticket: 'buyer' | 'seller' | 'admin', or null (not theirs). */
async function viewerRole(user, ticket) {
  if (ticket.buyer.equals(user._id)) return 'buyer';
  if (user.role === 'admin') return 'admin';
  if (user.role === 'seller' && (await Store.exists({ _id: ticket.store, owner: user._id }))) return 'seller';
  return null;
}

export async function loadTicket(user, id) {
  const ticket = await SupportTicket.findById(id).catch(() => null);
  const role = ticket && (await viewerRole(user, ticket));
  if (!role) throw new AppError(404, 'Request not found');
  return { ticket, role };
}

const link = (ticket, role) =>
  role === 'seller' ? `/seller/support/${ticket.id}` : role === 'admin' ? `/admin/support/${ticket.id}` : `/support/${ticket.id}`;

export async function ticketView(ticket, role) {
  const store = await Store.findById(ticket.store).select('name slug logo brandColor');
  const json = ticket.toJSON();
  return {
    ...json,
    categoryLabel: CATEGORY_LABEL[ticket.category],
    store: store ? { id: store.id, name: store.name, slug: store.slug, logo: store.logo, brandColor: store.brandColor } : null,
    viewerRole: role,
    // What this viewer may do next (the server checks again on every action).
    actions: allowedActions(ticket.status, role),
  };
}

/** Status changes each side may make. */
function allowedActions(status, role) {
  const a = [];
  if (role === 'buyer') {
    if (['open', 'in_progress', 'resolved'].includes(status)) a.push('escalated');
    if (status === 'resolved') a.push('open', 'closed');
    if (['open', 'in_progress', 'escalated'].includes(status)) a.push('closed');
  }
  if (role === 'seller' && ['open', 'in_progress', 'escalated'].includes(status)) a.push('resolved');
  if (role === 'admin') {
    if (status !== 'resolved' && status !== 'closed') a.push('resolved');
    if (status !== 'closed') a.push('closed');
    if (status === 'closed' || status === 'resolved') a.push('open');
  }
  return a;
}

/** POST /api/support — the buyer raises a problem with one of their paid orders. */
export async function openTicket(user, { orderId, category, description, images = [] }) {
  const order = await Order.findOne({ _id: orderId, buyer: user._id }).catch(() => null);
  if (!order) throw new AppError(404, 'Order not found');
  if (!RECEIPTED.includes(order.status)) throw new AppError(409, 'You can ask for help once the order is paid');
  const existing = await SupportTicket.findOne({ order: order._id, status: { $in: ACTIVE_TICKET } }).select('_id ticketNumber');
  if (existing) {
    throw new AppError(409, `You already have an open request for this order (${existing.ticketNumber})`, [
      { field: 'ticket', message: existing.id },
    ]);
  }

  const ticket = await SupportTicket.create({
    ticketNumber: `AS-${String(await nextSeq('ticket')).padStart(6, '0')}`,
    order: order._id,
    orderNumber: order.orderNumber,
    receiptNumber: order.receiptNumber,
    buyer: user._id,
    store: order.store,
    productName: order.items[0]?.name ?? 'Order',
    category,
    messages: [{ author: user._id, role: 'buyer', name: user.name, body: description, images }],
  });
  await notifyStoreOwner(order.store, {
    type: 'support',
    title: `After-sales request ${ticket.ticketNumber}`,
    body: `${CATEGORY_LABEL[category]} · ${ticket.productName} (${order.orderNumber})`,
    link: link(ticket, 'seller'),
  });
  return ticket;
}

const STATUS_NOTE = {
  escalated: (name) => `${name} asked Meet2buy to step in. A Meet2buy admin will review this request.`,
  resolved: (name) => `${name} marked this as resolved. If it isn't, reply or reopen it.`,
  closed: (name) => `${name} closed this request.`,
  open: (name) => `${name} reopened this request.`,
};

/** Who to tell about a change by `role`: the other side(s), and Meet2buy once it's escalated. */
async function tellOthers(ticket, role, notification) {
  const n = { type: 'support', ...notification };
  if (role !== 'buyer') notifyUser(ticket.buyer, { ...n, link: link(ticket, 'buyer') });
  if (role !== 'seller') await notifyStoreOwner(ticket.store, { ...n, link: link(ticket, 'seller') });
  if (role !== 'admin' && ticket.status === 'escalated') notifyAdmins({ ...n, link: link(ticket, 'admin') });
}

/** POST /api/support/:id/messages */
export async function addMessage(user, id, { body, images = [] }) {
  const { ticket, role } = await loadTicket(user, id);
  if (ticket.status === 'closed') throw new AppError(409, 'This request is closed. Open a new one from My orders if you need more help.');
  const store = role === 'seller' ? await Store.findById(ticket.store).select('name') : null;
  const name = role === 'seller' ? store.name : role === 'admin' ? 'Meet2buy support' : user.name;
  ticket.messages.push({ author: user._id, role, name, body, images });
  // The seller answering moves it along; the buyer writing on a "resolved" request reopens it.
  if (role === 'seller' && ticket.status === 'open') ticket.status = 'in_progress';
  if (role === 'buyer' && ticket.status === 'resolved') {
    ticket.status = 'open';
    ticket.resolvedAt = null;
  }
  ticket.lastActivityAt = new Date();
  await ticket.save();
  await tellOthers(ticket, role, { title: `New reply on ${ticket.ticketNumber}`, body: `${name}: ${body.slice(0, 90)}` });
  return { ticket, role };
}

/** PATCH /api/support/:id/status { status, note? } */
export async function changeStatus(user, id, { status, note }) {
  const { ticket, role } = await loadTicket(user, id);
  if (!allowedActions(ticket.status, role).includes(status)) throw new AppError(409, 'That change is not possible for this request now');
  const store = role === 'seller' ? await Store.findById(ticket.store).select('name') : null;
  const name = role === 'seller' ? store.name : role === 'admin' ? 'Meet2buy support' : user.name;

  if (note?.trim()) ticket.messages.push({ author: user._id, role, name, body: note.trim() });
  ticket.messages.push({ role: 'system', name: 'Meet2buy', body: STATUS_NOTE[status](name) });
  ticket.status = status;
  const now = new Date();
  if (status === 'escalated') ticket.escalatedAt = now;
  if (status === 'resolved') ticket.resolvedAt = now;
  if (status === 'closed') ticket.closedAt = now;
  if (status === 'open') {
    ticket.resolvedAt = null;
    ticket.closedAt = null;
  }
  ticket.lastActivityAt = now;
  await ticket.save();

  const titles = {
    escalated: `${ticket.ticketNumber} escalated to Meet2buy`,
    resolved: `${ticket.ticketNumber} marked resolved`,
    closed: `${ticket.ticketNumber} closed`,
    open: `${ticket.ticketNumber} reopened`,
  };
  await tellOthers(ticket, role, { title: titles[status], body: `${CATEGORY_LABEL[ticket.category]} · ${ticket.productName}` });
  return { ticket, role };
}

/** Lists: the buyer's own, a shop's, or (admin) everything, newest activity first. */
export async function listTickets({ buyer, store, status }) {
  const filter = {};
  if (buyer) filter.buyer = buyer;
  if (store) filter.store = store;
  if (status === 'active') filter.status = { $in: ACTIVE_TICKET };
  else if (status) filter.status = status;
  const tickets = await SupportTicket.find(filter).sort({ lastActivityAt: -1 }).limit(200).select('-messages.images');
  const [stores, buyers] = await Promise.all([
    Store.find({ _id: { $in: tickets.map((t) => t.store) } }).select('name slug'),
    User.find({ _id: { $in: tickets.map((t) => t.buyer) } }).select('name'),
  ]);
  const storeOf = new Map(stores.map((s) => [s.id, s]));
  const buyerOf = new Map(buyers.map((b) => [b.id, b]));
  return tickets.map((t) => {
    const last = t.messages[t.messages.length - 1];
    return {
      id: t.id,
      ticketNumber: t.ticketNumber,
      order: t.order.toString(),
      orderNumber: t.orderNumber,
      productName: t.productName,
      category: t.category,
      categoryLabel: CATEGORY_LABEL[t.category],
      status: t.status,
      store: storeOf.get(t.store.toString())?.name ?? '—',
      buyer: buyerOf.get(t.buyer.toString())?.name ?? 'Deleted account',
      lastMessage: last ? { name: last.name, role: last.role, body: last.body.slice(0, 140) } : null,
      lastActivityAt: t.lastActivityAt,
      createdAt: t.createdAt,
    };
  });
}
