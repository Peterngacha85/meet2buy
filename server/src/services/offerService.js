import { Offer } from '../models/Commerce.js';
import { Product } from '../models/Product.js';
import { Settings } from '../models/Settings.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { emitTo, sellerRoom, userRoom } from '../sockets/io.js';
import { userPresent } from '../sockets/presence.js';
import { loadLiveSession } from './roomService.js';

// The seller's custom price for one buyer in the room (doc 02 §1.5, doc 07 offer:create / offer:decline).

export function offerView(o, product = null) {
  return {
    id: o._id.toString(),
    session: o.session.toString(),
    buyer: o.buyer.toString(),
    product: product
      ? { id: product._id.toString(), name: product.name, images: product.images, price: product.price }
      : { id: o.product.toString(), name: o.productName },
    variant: o.variant,
    quantity: o.quantity,
    price: o.price,
    status: o.status === 'pending' && o.expiresAt <= new Date() ? 'expired' : o.status,
    expiresAt: o.expiresAt,
    createdAt: o.createdAt,
  };
}

export async function createOffer(sessionId, { buyerId, productId, variant = '', quantity, price }) {
  const session = await loadLiveSession(sessionId);
  if (!userPresent(sessionId, String(buyerId))) throw new AppError(409, 'That shopper has left the room');
  const [product, buyer, settings] = await Promise.all([
    Product.findOne({ _id: productId, store: session.store, isVisible: true }).catch(() => null),
    User.findById(buyerId).select('name').catch(() => null),
    Settings.getGlobal(),
  ]);
  if (!product) throw new AppError(404, 'That product is not on your shelf');
  if (!buyer) throw new AppError(404, 'Shopper not found');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new AppError(400, 'Quantity must be 1 to 10');
  if (!Number.isInteger(price) || price < 1) throw new AppError(400, 'Enter the total price in whole shillings');
  if (product.stock < quantity) throw new AppError(409, `Only ${product.stock} in stock`);

  // A new offer replaces any earlier one still waiting for this buyer.
  const replaced = await Offer.find({ session: sessionId, buyer: buyerId, status: 'pending' }).select('_id');
  await Offer.updateMany({ _id: { $in: replaced.map((o) => o._id) } }, { status: 'expired' });

  const offer = await Offer.create({
    session: sessionId,
    store: session.store,
    buyer: buyerId,
    product: product._id,
    productName: product.name,
    variant: String(variant ?? '').slice(0, 80),
    quantity,
    price,
    expiresAt: new Date(Date.now() + settings.offerExpiryMinutes * 60_000),
  });
  const view = { ...offerView(offer, product), buyerName: buyer.name };
  for (const o of replaced) emitTo(userRoom(String(buyerId)), 'offer:updated', { offerId: o.id, status: 'expired' });
  emitTo(userRoom(String(buyerId)), 'offer:received', view);
  emitTo(sellerRoom(sessionId), 'offer:updated', { offerId: view.id, status: 'pending', offer: view });
  return view;
}

export async function declineOffer(user, offerId) {
  const offer = await Offer.findOneAndUpdate(
    { _id: offerId, buyer: user._id, status: 'pending' },
    { status: 'declined' },
    { returnDocument: 'after' },
  ).catch(() => null);
  if (!offer) throw new AppError(404, 'This offer is no longer open');
  emitTo(sellerRoom(offer.session.toString()), 'offer:updated', { offerId: offer.id, status: 'declined' });
  emitTo(userRoom(user.id), 'offer:updated', { offerId: offer.id, status: 'declined' });
}

/** Open offers for one buyer in a room (for room:state after a refresh). */
export async function openOffersFor(sessionId, userId) {
  const offers = await Offer.find({ session: sessionId, buyer: userId, status: 'pending', expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .populate('product', 'name images price');
  return offers.map((o) => offerView(o, o.product?.name ? o.product : null));
}
