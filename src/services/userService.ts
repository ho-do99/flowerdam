import prisma from '../config/database';
import { hashPassword, verifyPassword } from '../utils/password';

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: string;
  partner_id?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  status: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export class UserService {
  async createUser(input: CreateUserInput): Promise<UserResponse> {
    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new Error('Email already exists');
    }

    // 비밀번호 해싱
    const hashedPassword = await hashPassword(input.password);

    // 사용자 생성
    const userData: any = {
      email: input.email,
      password: hashedPassword,
      name: input.name,
      phone: input.phone,
      role: input.role as any,
      status: 'PENDING',
    };

    // 직원의 경우 partner_id 추가
    if (input.partner_id) {
      userData.partner_id = input.partner_id;
    }

    const user = await prisma.user.create({
      data: userData,
    });

    return this.formatUserResponse(user);
  }

  async getUserByEmail(email: string): Promise<UserResponse | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    return user ? this.formatUserResponse(user) : null;
  }

  async getUserById(id: string): Promise<UserResponse | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    return user ? this.formatUserResponse(user) : null;
  }

  async getUserWithPassword(email: string): Promise<any | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async updateUser(id: string, input: Partial<CreateUserInput>): Promise<UserResponse> {
    const updateData: any = {};

    if (input.name) updateData.name = input.name;
    if (input.phone) updateData.phone = input.phone;
    if (input.password) updateData.password = await hashPassword(input.password);

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    return this.formatUserResponse(user);
  }

  async saveRefreshToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await prisma.refreshToken.create({
      data: {
        user_id: userId,
        token,
        expires_at: expiresAt,
      },
    });
  }

  async getRefreshToken(userId: string, token: string): Promise<any | null> {
    return prisma.refreshToken.findUnique({
      where: { token },
    });
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await prisma.refreshToken.delete({
      where: { token },
    }).catch(() => {}); // 토큰이 없어도 무시
  }

  async updateUserStatus(id: string, status: string): Promise<UserResponse> {
    const user = await prisma.user.update({
      where: { id },
      data: { status: status as any },
    });

    return this.formatUserResponse(user);
  }

  private formatUserResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status,
    };
  }
}

export const userService = new UserService();
