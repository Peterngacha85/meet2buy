import { z } from 'zod';
import { TICKET_CATEGORIES } from '../models/SupportTicket.js';
import { imageUrl, objectId } from './storeValidators.js';

const images = z.array(imageUrl).max(4, 'At most 4 photos').optional();

export const openTicketSchema = z.object({
  orderId: objectId('order'),
  category: z.enum(TICKET_CATEGORIES, { error: 'Choose what went wrong' }),
  description: z.string().trim().min(10, 'Tell the seller a bit more (at least 10 characters)').max(2000),
  images,
});

export const messageSchema = z.object({
  body: z.string().trim().min(1, 'Write a message').max(2000),
  images,
});

export const ticketStatusSchema = z.object({
  status: z.enum(['open', 'escalated', 'resolved', 'closed']),
  note: z.string().trim().max(1000).optional(),
});
