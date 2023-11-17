import { Module, UseGuards } from '@nestjs/common';
import {
	Args,
	Context,
	Field,
	ID,
	Mutation,
	ObjectType,
	Parent,
	ResolveField,
	Resolver,
} from '@nestjs/graphql';
import { CredentialType } from '@prisma/client';
import { AuthModule, AuthService, LocalGuard } from 'src/auth';
import { User } from './users';
import { Request } from 'express';
import { UserContext } from '../common/decorators/userContext';
import { Login } from '../common/middlewares/scopesManager';
import { PrismaModule, PrismaService } from '../prisma';
import { LoggedInField } from '../common/middlewares/scopesMiddleware';

@ObjectType()
export class Credential {
	/**
	 * The ID of the credential.
	 */
	@Field(() => ID)
	id: string;

	/**
	 * userId is the ID of the user this credential belongs to.
	 */
	userId: string;

	/**
	 * The type of the credential.
	 */
	type: CredentialType;

	/**
	 * Token is the actual credential. It is hashed in the database.
	 */
	@LoggedInField()
	token: string;

	/**
	 * The userAgent of the device that created this credential.
	 */
	userAgent: string;

	/**
	 * Time when this credential was created.
	 */
	createdAt: Date;

	/**
	 * Time when this credential expires.
	 */
	expiresAt?: Date;

	active: boolean;

	/**
	 * The user this credential belongs to.
	 */
	user: User;
}

@ObjectType()
export class LoginResponse {
	token: string;
}

@Resolver(() => Credential)
export class CredentialsResolver {
	constructor(
		private prisma: PrismaService,
		private authService: AuthService,
	) {}

	@Mutation(() => LoginResponse)
	@UseGuards(LocalGuard)
	async login(
		@Args('email') email: string,
		@Args('password') password: string,
		@UserContext() user: User,
	): Promise<LoginResponse> {
		return await this.authService.login(user);
	}

	@Mutation(() => Boolean, {
		description: 'Logs a user out and invalidates the session token.',
	})
	async logout(@Context() req: Request): Promise<boolean> {
		await this.authService.logout(req);
		return true;
	}

	@Mutation(() => Boolean)
	@Login()
	async deleteToken(
		@Args('id') id: string,
		@UserContext() user: User,
	): Promise<boolean> {
		try {
			await this.prisma.credential.delete({
				where: {
					id,
					userId: user.id,
					type: CredentialType.Jwt || CredentialType.Token,
				},
			});
		} catch (e) {
			return false;
		}

		return true;
	}

	@Mutation(() => Boolean)
	@Login()
	async renameSession(
		@Args('id') id: string,
		@Args('name') name: string,
		@UserContext() user: User,
	) {
		try {
			await this.prisma.credential.update({
				where: {
					id,
					userId: user.id,
					type: CredentialType.Jwt || CredentialType.Token,
				},
				data: { name },
			});
		} catch (e) {
			return false;
		}

		return true;
	}

	@ResolveField('active', () => Boolean)
	async active(@Parent() credential: Credential, @Context() req: Request) {
		return (
			credential.type in [CredentialType.Jwt, CredentialType.Token] &&
			req.headers.authorization === `Bearer ${credential.token}`
		);
	}

	@ResolveField('user', () => User)
	async user(@Parent() credential: Credential) {
		return this.prisma.user.findUnique({
			where: { id: credential.userId },
		});
	}
}

@Module({
	imports: [AuthModule, PrismaModule],
	providers: [CredentialsResolver],
})
export class CredentialsModule {}
