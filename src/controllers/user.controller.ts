import { FastifyRequest, FastifyReply } from 'fastify';
import * as userService from '../services/user.service';
import { handleError, notFound, forbidden } from '../utils/errors';

// Get all users
export async function getAllUsers(
  request: FastifyRequest<{ Querystring: any }>,
  reply: FastifyReply
) {
  try {
    const filters = request.query;
    const users = await userService.getAllUsers(filters);
    return reply.code(200).send({ users });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get user by ID
export async function getUserById(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const user = await userService.getUserById(id);
    if (!user) throw notFound('User');
    return reply.code(200).send({ user });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Update user profile
export async function updateUserProfile(
  request: FastifyRequest<{ Params: { id: string }; Body: any }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const currentUser = request.user;
    const user = await userService.updateUserProfile(id, request.body, currentUser);
    return reply.code(200).send({ message: 'User profile updated', user });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Change user role
export async function changeUserRole(
  request: FastifyRequest<{ Params: { id: string }; Body: { role: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { role } = request.body;
    const currentUser = request.user;
    const user = await userService.changeUserRole(id, role, currentUser);
    return reply.code(200).send({ message: 'User role updated', user });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Set user active status
export async function setUserActive(
  request: FastifyRequest<{ Params: { id: string }; Body: { isActive: boolean } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { isActive } = request.body;
    const currentUser = request.user;
    const user = await userService.setUserActive(id, isActive, currentUser);
    return reply.code(200).send({ message: 'User active status updated', user });
  } catch (error) {
    handleError(error, request, reply);
  }
} 