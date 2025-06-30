import { FastifyRequest, FastifyReply } from 'fastify';
import { LoginRequest, RegisterUserRequest, UserRole } from '../types';
import * as authService from '../services/auth.service';
import * as userService from '../services/user.service';
import { handleError, badRequest, notFound } from '../utils/errors';

export async function requestOtp(
  request: FastifyRequest<{ Body: { phone: string } }>,
  reply: FastifyReply
) {
  try {
    const { phone } = request.body;
    await authService.sendOtp(phone);
    return reply.code(200).send({
      message: 'OTP sent successfully',
      phone
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

export async function login(
  request: FastifyRequest<{ Body: { idToken: string; role: UserRole } }>,
  reply: FastifyReply
) {
  try {
    const { idToken, role } = request.body;
    const result = await authService.loginWithFirebase(request.server, idToken, role);
    return reply.code(200).send(result);
  } catch (error) {
    
    handleError(error, request, reply);
  }
}

export async function register(
  request: FastifyRequest<{ Body: RegisterUserRequest & { firebaseUid: string } }>,
  reply: FastifyReply
) {
  try {
    const userData = request.body;
    const user = await userService.createUser(userData);
    const tokens = authService.generateTokens(user);

    return reply.code(201).send({
      message: 'User registered successfully',
      user,
      ...tokens
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

export async function refreshToken(
  request: FastifyRequest<{ Body: { refreshToken: string } }>,
  reply: FastifyReply
) {
  try {
    const { refreshToken } = request.body;
    const result = await authService.refreshAccessToken(refreshToken);

    return reply.code(200).send(result);
  } catch (error) {
    handleError(error, request, reply);
  }
}

export async function verifyToken(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const user = await userService.getUserById(request.user.userId);

    if (!user) {
      throw notFound('User');
    }

    return reply.code(200).send({ user });
  } catch (error) {
    handleError(error, request, reply);
  }
}

export async function logout(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Since we're using JWTs, actual logout is handled client-side
  // by removing the token. This endpoint is mostly for API completeness.
  return reply.code(200).send({ message: 'Logged out successfully' });
}

export async function changeRole(
  request: FastifyRequest<{
    Params: { id: string },
    Body: { role: UserRole }
  }>,
  reply: FastifyReply
) {
  try {
    // Only admins can change roles
    if (request.user.role !== UserRole.ADMIN) {
      throw badRequest('Not authorized to change user roles');
    }

    const { id } = request.params;
    const { role } = request.body;

    const user = await userService.updateUserRole(id, role);

    return reply.code(200).send({
      message: 'User role updated successfully',
      user
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

export async function me(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    return reply.code(200).send({ user: request.user });
  } catch (error) {
    handleError(error, request, reply);
  }

}

export async function checkRole(
  request: FastifyRequest<{
    Querystring: { phoneNumber: string; role: UserRole }
  }>,
  reply: FastifyReply
) {

  try {

    console.log("request.query is ",request.query)

    const { phoneNumber, role } = request.query;

    const result = await authService.checkRole(phoneNumber, role)
    return reply.code(200).send(result)


  } catch (error) {
    handleError(error, request, reply)
}

}