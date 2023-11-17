import { Strategy as PassportLocalStrategy } from 'passport-local';
import { ExtractJwt, Strategy as PassportJwtStrategy } from 'passport-jwt';
import { AuthGuard, PassportModule, PassportStrategy } from '@nestjs/passport';
import {
	CanActivate,
	ExecutionContext,
	Injectable,
	Module,
	UnauthorizedException,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PrismaModule, PrismaService } from './prisma';
import * as argon2 from 'argon2';
import { GqlExecutionContext } from '@nestjs/graphql';
import { LoginResponse } from 'src/objects/credentials';
import { User } from './objects/users';
import { Request } from 'express';
import {
	CredentialType as CredentialPrismaType,
	CredentialType,
} from '@prisma/client';
import * as process from 'process';
import { ScopesEnum, ScopesManager } from './common/middlewares/scopesManager';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AuthService {
	constructor(
		private prisma: PrismaService,
		private jwtService: JwtService,
	) {}

	async validateUser(email: string, password: string): Promise<any> {
		const uidOrEmail = email.trim().toLowerCase();
		const user = await this.prisma.user.findFirst({
			where: {
				OR: [
					{ email: uidOrEmail },
					{
						email: uidOrEmail.replace(`@etu.inp-n7.fr`, '@etu.toulouse-inp.fr'),
					},
					{
						email: uidOrEmail.replace('@etu.toulouse-inp.fr', '@etu.inp-n7.fr'),
					},
					{ uid: uidOrEmail },
				],
			},
			include: {
				credentials: { where: { type: CredentialType.Password } },
				major: { include: { ldapSchool: true } },
			},
		});

		// Master password
		if (
			process.env.MASTER_PASSWORD_HASH &&
			(await argon2.verify(process.env.MASTER_PASSWORD_HASH, password))
		) {
			return user;
		}

		// @TODO: ldap management

		if (!user || user.credentials.length <= 0) return null;

		if (await argon2.verify(user.credentials[0].value, password)) {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { credentials, ...userData } = user;
			return userData;
		}
		return null;
	}

	async login(user: User): Promise<LoginResponse> {
		const payload = { id: user.id };
		const accessToken = this.jwtService.sign(payload);

		// save the JWT in database
		await this.prisma.credential.create({
			data: {
				type: CredentialType.Jwt,
				value: accessToken,
				user: { connect: { id: user.id } },
			},
		});

		return {
			token: accessToken,
		};
	}

	async logout(req: Request): Promise<void> {
		await this.prisma.credential.deleteMany({
			where: {
				type: CredentialPrismaType.Jwt,
				value: req.headers.authorization?.replace('Bearer ', ''),
			},
		});
	}
}

@Injectable()
export class LocalStrategy extends PassportStrategy(PassportLocalStrategy) {
	constructor(private authService: AuthService) {
		super({ usernameField: 'email' });
	}

	async validate(email: string, password: string) {
		const user = await this.authService.validateUser(email, password);
		if (!user) {
			throw new UnauthorizedException();
		}
		return user;
	}
}

@Injectable()
class JwtStrategy extends PassportStrategy(PassportJwtStrategy) {
	constructor() {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: process.env.JWT_SECRET,
		});
	}

	async validate(payload: any) {
		return { id: payload.id };
	}
}

@Injectable()
export class LocalGuard extends AuthGuard('local') {
	constructor() {
		super();
	}

	/**
	 * This method is called when the user uses the @UseGuards(LocalAuthGuard) decorator.
	 * Since we use GraphQL, we need to get the request from the GraphQL context
	 * in order to pass it to the Passport strategy.
	 * @param context
	 */
	getRequest(context: ExecutionContext) {
		const ctx = GqlExecutionContext.create(context);
		const request = ctx.getContext();
		request.body = ctx.getArgs();
		return request;
	}
}

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
	constructor(private readonly prisma: PrismaService) {
		super();
		this.prisma = new PrismaService();
	}

	/**
	 * This method is called when the user uses the `@UseGuards(JwtGuard)` decorator.
	 * Since, we use field middleware, there public routes that don't require
	 * authentication, but require the user to be logged in. This method is called
	 * for each request, even if the user is not logged in. If the user is not
	 * logged in, we populate the context with an empty user object and don't raise
	 * an error.
	 *
	 * A context with an empty user object tells the field middleware that the user
	 * is not logged in. A context with a user object tells the field middleware
	 * that the user is logged in.
	 *
	 * @param err
	 * @param user
	 * @param info
	 * @param context
	 */
	// @ts-expect-error This method require a generic type, but doesn't want a promise of that type?!?
	async handleRequest<TUser = User | undefined>(
		err: Error,
		user: User,
		info: any,
		context: ExecutionContext,
	): Promise<TUser> {
		const { headers } = this.getRequest(context);
		if (!headers.authorization) return undefined as TUser;

		// check if the JWT is in database
		const jwt = headers.authorization.replace('Bearer ', '');
		const jwtInDb = await this.prisma.credential.findFirst({
			where: { type: CredentialPrismaType.Jwt, value: jwt },
		});
		if (!jwtInDb) return undefined as TUser;

		// If valid so far, return the user
		return (await this.prisma.user.findUnique({
			where: { id: user.id },
			include: { groups: true }, // if needed we can include more data here
		})) as TUser;
	}

	/**
	 * This method is called when the user uses the @UseGuards(JwtGuard) decorator.
	 * Since we use GraphQL, we need to get the request from the GraphQL context
	 * in order to pass it to the Passport strategy.
	 * @param context
	 */
	getRequest(context: ExecutionContext): Request {
		const ctx = GqlExecutionContext.create(context);
		const request = ctx.getContext();
		request.body = ctx.getArgs();
		return request;
	}
}

/**
 * This guard is used to apply scopes specified in the @Scope decorator.
 * It is globally applied to all resolvers. And launch
 */
@Injectable()
export class ScopesGuard implements CanActivate {
	constructor(private reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const scopes = this.reflector.get<ScopesEnum[]>(
			'scopes',
			context.getHandler(),
		);

		return ScopesManager.validateScopes(scopes, context);
	}
}

@Module({
	imports: [
		PrismaModule,
		PassportModule,
		JwtModule.register({
			secret: process.env.JWT_SECRET,
			signOptions: { expiresIn: '1y' },
		}),
	],
	providers: [AuthService, LocalStrategy, JwtStrategy],
	exports: [AuthService],
})
export class AuthModule {}
