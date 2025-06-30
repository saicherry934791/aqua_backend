import fastify, { FastifyInstance } from 'fastify';
import { User, UserRole, LoginResponse } from '../types';
import { generateId } from '../utils/helpers';
import { unauthorized, badRequest, serverError, notFound } from '../utils/errors';
import jwt from 'jsonwebtoken';
import * as userService from './user.service';
import admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { eq, and } from 'drizzle-orm';
import { users } from '../models/schema';
import { getFastifyInstance } from '../shared/fastify-instance';



export async function sendOtp(phone: string): Promise<void> {
  // Implementation would depend on the Firebase plugin

  if (!fastify.firebase) {
    throw new Error('Firebase not initialized');
  }

  try {
    // In a real implementation, use Firebase to send OTP
    // This is a mock implementation
    fastify.log.info(`Sending OTP to ${phone}`);

    // Here we would call Firebase Auth to send the verification code
    // await fastify.firebase.auth().sendSignInLinkToPhone(phone, { ...settings });

    return;
  } catch (error) {
    fastify.log.error(`Error sending OTP to ${phone}: ${error}`);
    throw error;
  }
}

export async function verifyOtp(
  phone: string,
  otpCode: string
): Promise<{
  registrationRequired: boolean;
  phone: string;
  firebaseUid?: string;
  authData?: LoginResponse;
}> {
  // Implementation would depend on the Firebase plugin
  const fastify = (global as any).fastify as FastifyInstance;

  if (!fastify.firebase) {
    throw new Error('Firebase not initialized');
  }

  try {
    // In a real implementation, verify the OTP with Firebase
    // This is a mock implementation
    fastify.log.info(`Verifying OTP ${otpCode} for ${phone}`);

    // Here we would verify the code with Firebase Auth
    // const result = await fastify.firebase.auth().verifyPhoneNumber(phone, otpCode);
    // const firebaseUid = result.uid;

    // For demo purposes, we'll create a mock Firebase UID
    const firebaseUid = `firebase_${generateId('user')}`;

    // Check if user exists
    const user = await userService.getUserByPhone(phone);

    if (!user) {
      // User doesn't exist, registration required
      return {
        registrationRequired: true,
        phone,
        firebaseUid
      };
    }

    // Update Firebase UID if it's not already set
    if (!user.firebaseUid) {
      await userService.updateFirebaseUid(user.id, firebaseUid);
    }

    // Generate tokens
    const tokens = generateTokens(user);

    return {
      registrationRequired: false,
      phone,
      authData: {
        ...tokens,
        user
      }
    };
  } catch (error) {
    fastify.log.error(`Error verifying OTP for ${phone}: ${error}`);
    throw error;
  }
}

export function generateTokens(user: User): { accessToken: string; refreshToken: string } {
  const fastify = getFastifyInstance();

  if (!fastify.jwt) {
    throw new Error('JWT not initialized');
  }

  const accessTokenExpiry = process.env.JWT_ACCESS_EXPIRES_IN || '1h';
  const refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  const payload = {
    userId: user.id,
    role: user.role,
    franchiseAreaId: user.franchiseAreaId
  };

  const accessToken = fastify.jwt.sign(payload, { expiresIn: accessTokenExpiry });
  const refreshToken = fastify.jwt.sign({ ...payload, type: 'refresh' }, { expiresIn: refreshTokenExpiry });

  return { accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
  const fastify = getFastifyInstance()

  if (!fastify?.jwt) {
    throw new Error('JWT not initialized');
  }

  try {
    // Verify the refresh token
    const decoded = fastify.jwt.verify(refreshToken) as jwt.JwtPayload;

    // Check if token is a refresh token
    if (!decoded.type || decoded.type !== 'refresh') {
      throw unauthorized('Invalid refresh token');
    }

    // Check if user exists
    const user = await userService.getUserById(decoded.userId);

    if (!user) {
      throw unauthorized('User not found');
    }

    // Check if user is still active
    if (!user.isActive) {
      throw unauthorized('User account is inactive');
    }

    // Generate new access token
    const accessTokenExpiry = process.env.JWT_ACCESS_EXPIRES_IN || '1h';
    const payload = {
      userId: user.id,
      role: user.role,
      franchiseAreaId: user.franchiseAreaId
    };

    const accessToken = fastify.jwt.sign(payload, { expiresIn: accessTokenExpiry });

    return { accessToken };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw unauthorized('Invalid refresh token');
    }
    throw error;
  }
}

export function verifyRole(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole);
}

export async function loginWithFirebase(fastify: any, idToken: string, role: UserRole) {
  try {
    console.log('came here ')
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const db = fastify.db;
    const userFromFirebase = await admin.auth().getUser(decodedToken.uid);
    console.log('userFromFirebase ',userFromFirebase)
    if (!userFromFirebase) {
      throw new Error('User not found in Firebase');
    }
  
    // Check if user exists with specific phone and role combination
    let user = await db.query.users.findFirst({
      where: and(
        eq(users.phone, userFromFirebase.phoneNumber),
        eq(users.role, role)
      ),
    });

    // If user doesn't exist with this phone-role combination, create a new user
    if (!user) {
      const userId = uuidv4();
      const now = new Date();
      await db.insert(users).values({
        id: userId,
        email: userFromFirebase.email || '',
        name: userFromFirebase.displayName || '',
        phone: userFromFirebase.phoneNumber || '',
        role: role,
        firebaseUid: decodedToken.uid,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        isActive: true,
      });
      user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    }
    if (!user) {
      throw new Error('User not found after creation');
    }
    // Generate JWT tokens
    const tokens = await generateTokens(user);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user,
    };
  } catch (error) {
    
    throw badRequest('Invalid Firebase ID token: ' + error);
  }
}

export async function checkRole(phoneNumber: string, role: UserRole) {
  try {
    const fastify = getFastifyInstance() as FastifyInstance;
    const db = fastify.db;

    console.log('db here is ', db)

    const samplecall = await db.select().from(users);
    console.log('samplecall ', samplecall)
    const user = await db.query.users.findFirst({
      where: and(
        eq(users.phone, phoneNumber),
        eq(users.role, role)
      )
    })

    if (user) {
      return {
        exists: true,
        role: user.role,
        userId: user.id
      }
    }

    return {
      exists: false,
      role: null,
      userId: null
    };


  } catch (error) {
    throw serverError('Something Went Wrong : ' + error);
  }

}