import { Store } from '../models/Store.js';
import { ok } from '../utils/respond.js';
import { addMessage, changeStatus, listTickets, loadTicket, openTicket, ticketView } from '../services/supportService.js';

// After-sales requests (doc 06 /api/support).

// POST /api/support — buyer
export async function create(req, res) {
  const ticket = await openTicket(req.user, req.body);
  ok(res, { ticket: await ticketView(ticket, 'buyer') }, 201);
}

// GET /api/support/mine — buyer's requests
export async function mine(req, res) {
  ok(res, { tickets: await listTickets({ buyer: req.user._id, status: req.query.status }) });
}

// GET /api/support/store — the seller's shop's requests
export async function forStore(req, res) {
  const store = await Store.findOne({ owner: req.user._id }).select('_id');
  ok(res, { tickets: store ? await listTickets({ store: store._id, status: req.query.status }) : [] });
}

// GET /api/support — admin: every request (?status=escalated to see what needs Meet2buy)
export async function all(req, res) {
  ok(res, { tickets: await listTickets({ status: req.query.status }) });
}

// GET /api/support/:id — buyer, seller or admin
export async function show(req, res) {
  const { ticket, role } = await loadTicket(req.user, req.params.id);
  ok(res, { ticket: await ticketView(ticket, role) });
}

// POST /api/support/:id/messages
export async function reply(req, res) {
  const { ticket, role } = await addMessage(req.user, req.params.id, req.body);
  ok(res, { ticket: await ticketView(ticket, role) });
}

// PATCH /api/support/:id/status
export async function status(req, res) {
  const { ticket, role } = await changeStatus(req.user, req.params.id, req.body);
  ok(res, { ticket: await ticketView(ticket, role) });
}
