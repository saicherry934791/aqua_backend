import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { users } from '../models/schema';
import { User, UserRole, RegisterUserRequest, GeoLocation } from '../types';
import { generateId } from '../utils/helpers';
import { notFound, conflict, badRequest } from '../utils/errors';
import * as franchiseService from './franchise.service';

export async function createUser(userData: RegisterUserRequest & { firebaseUid?: string }): Promise<User> {
  const fastify = (global as any).fastify as FastifyInstance;
  
  // Check if user already exists
  const existingUser = await getUserByPhone(userData.phone);
  if (existingUser) {
    throw conflict(`User with phone ${userData.phone} already exists`);
  }

  // Find franchise area for the user's location if provided
  let franchiseAreaId: string | undefined = undefined;
  if (userData.location) {
    franchiseAreaId = await findFranchiseAreaForUser(userData.location);
  }

  const newUser: Omit<User, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string } = {
    id: generateId('user'),
    phone: userData.phone,
    name: userData.name,
    email: userData.email,
    address: userData.address,
    alternativePhone: userData.alternativePhone,
    role: UserRole.CUSTOMER, // Default role for new registrations
    location: userData.location,
    franchiseAreaId,
    isActive: true,
    firebaseUid: userData.firebaseUid,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await fastify.db.insert(users).values({
    ...newUser,
    locationLatitude: userData.location?.latitude,
    locationLongitude: userData.location?.longitude,
  });

  const createdUser = await getUserById(newUser.id);
  if (!createdUser) {
    throw new Error('Failed to create user');
  }

  return createdUser;
}

export async function getUserById(id: string): Promise<User | null> {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const result = await fastify.db.query.users.findFirst({
    where: eq(fastify.db.query.users.id, id),
  });

  if (!result) {
    return null;
  }

  return {
    ...result,
    location: result.locationLatitude && result.locationLongitude
      ? { latitude: result.locationLatitude, longitude: result.locationLongitude }
      : undefined,
  } as User;
}

export async function getUserByPhone(phone: string): Promise<User | null> {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const result = await fastify.db.query.users.findFirst({
    where: eq(fastify.db.query.users.phone, phone),
  });

  if (!result) {
    return null;
  }

  return {
    ...result,
    location: result.locationLatitude && result.locationLongitude
      ? { latitude: result.locationLatitude, longitude: result.locationLongitude }
      : undefined,
  } as User;
}

export async function updateUserRole(userId: string, role: UserRole): Promise<User> {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const user = await getUserById(userId);
  if (!user) {
    throw notFound('User');
  }

  await fastify.db
    .update(users)
    .set({ 
      role, 
      updatedAt: new Date().toISOString() 
    })
    .where(eq(users.id, userId));

  const updatedUser = await getUserById(userId);
  if (!updatedUser) {
    throw new Error('Failed to update user');
  }

  return updatedUser;
}

export async function updateFirebaseUid(userId: string, firebaseUid: string): Promise<User> {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const user = await getUserById(userId);
  if (!user) {
    throw notFound('User');
  }

  await fastify.db
    .update(users)
    .set({ 
      firebaseUid, 
      updatedAt: new Date().toISOString() 
    })
    .where(eq(users.id, userId));

  const updatedUser = await getUserById(userId);
  if (!updatedUser) {
    throw new Error('Failed to update user Firebase UID');
  }

  return updatedUser;
}

export async function updateUserLocation(userId: string, location: GeoLocation): Promise<User> {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const user = await getUserById(userId);
  if (!user) {
    throw notFound('User');
  }

  // Find franchise area for the new location
  const franchiseAreaId = await findFranchiseAreaForUser(location);

  await fastify.db
    .update(users)
    .set({ 
      locationLatitude: location.latitude,
      locationLongitude: location.longitude,
      franchiseAreaId,
      updatedAt: new Date().toISOString() 
    })
    .where(eq(users.id, userId));

  const updatedUser = await getUserById(userId);
  if (!updatedUser) {
    throw new Error('Failed to update user location');
  }

  return updatedUser;
}

export async function getServiceAgentsByFranchiseArea(franchiseAreaId: string): Promise<User[]> {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const results = await fastify.db.query.users.findMany({
    where: (user) => {
      return eq(user.franchiseAreaId, franchiseAreaId) && eq(user.role, UserRole.SERVICE_AGENT);
    },
  });

  return results.map(result => ({
    ...result,
    location: result.locationLatitude && result.locationLongitude
      ? { latitude: result.locationLatitude, longitude: result.locationLongitude }
      : undefined,
  })) as User[];
}

export async function findFranchiseAreaForUser(location: GeoLocation): Promise<string | undefined> {
  // This would call a service to find which franchise area the location falls into
  // For now, we'll create a placeholder that would be implemented in franchise.service.ts
  return franchiseService.findFranchiseAreaForLocation(location);
}