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
import { UserAgent } from 'src/decorators/userAgent';
import { Request } from 'express';

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
		@UserAgent() userAgent: string,
		@Context() request: Request, // @TODO: change for a user decorator instead requesting all the request object
	): Promise<LoginResponse> {
		return this.authService.login(request.user);
	}
}

@Module({
	imports: [AuthModule],
	providers: [CredentialsResolver],
})
export class CredentialsModule {}
