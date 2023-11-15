import { Module, UseGuards } from '@nestjs/common';
import {
	Args,
	Context,
	Field,
	ID,
	Mutation,
	ObjectType,
	Resolver,
} from '@nestjs/graphql';
import type { CredentialType } from '@prisma/client';
import { AuthModule, AuthService, LocalGuard } from 'src/auth';
import { User } from './users';
import { UserContext } from '../common/decorators/user';
import { Request } from 'express';
import { LoggedInGuard } from '../common/middlewares/scopesGuard';

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

	/**"id"
') id: string): Promise<boolean> {
// await this.authService.deleteToken(id);
		returntrue;
	 * Token is the actual credential. It is hashed in the database.
	 */
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

	// user
}

@ObjectType()
export class LoginResponse {
	access_token: string;
}

@Resolver(() => Credential)
export class CredentialsResolver {
	constructor(private authService: AuthService) {}

	@Mutation(() => LoginResponse)
	@UseGuards(LocalGuard)
	async login(
		@Args('email') email: string,
		@Args('password') password: string,
		@UserContext() user: User,
	): Promise<LoginResponse> {
		return await this.authService.login(user);
	}

	@UseGuards(LoggedInGuard)
	@Mutation(() => Boolean, {
		description: 'Logs a user out and invalidates the session token.',
	})
	async logout(@Context() req: Request): Promise<boolean> {
		await this.authService.logout(req);
		return true;
	}

	@UseGuards(LoggedInGuard)
	@Mutation(() => Boolean, {
		description: 'Invalidates a JWT.',
	})
	async deleteToken(@Args('id') id: string): Promise<boolean> {
		console.log(id);
		// @TODO: implement
		// await this.authService.deleteToken(id);
		return true;
	}
}

@Module({
	imports: [AuthModule],
	providers: [CredentialsResolver],
})
export class CredentialsModule {}
