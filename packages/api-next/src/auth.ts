import { Strategy as PassportLocalStrategy } from 'passport-local';
import { ExtractJwt, Strategy as PassportJwtStrategy } from 'passport-jwt';
import { AuthGuard, PassportModule, PassportStrategy } from '@nestjs/passport';
import {
	ExecutionContext,
	Injectable,
	Module,
	UnauthorizedException,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PrismaModule, PrismaService } from './prisma';
import { CredentialType } from '@prisma/client';
import * as argon2 from 'argon2';
import { GqlExecutionContext } from '@nestjs/graphql';
import { LoginResponse } from 'src/objects/credentials';
import { User } from './objects/users';

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

		if (!user || user.credentials.length <= 0) return null;

		if (await argon2.verify(user.credentials[0].value, password)) {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { credentials, ...userData } = user;
			return userData;
		}
		return null;
	}

	login(user: User): LoginResponse {
		const payload = { id: user.id };
		return {
			access_token: this.jwtService.sign(payload),
		};
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
	constructor() {
		super();
	}

	// canActivate(context: ExecutionContext) {
	// 	console.log('canActivate');
	// 	return super.canActivate(context);
	// }

	/**
	 * This method is called when the user uses the @UseGuards(JwtGuard) decorator.
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

@Module({
	imports: [
		PassportModule,
		JwtModule.register({
			secret: process.env.JWT_SECRET,
			signOptions: { expiresIn: '1y' },
		}),
		PrismaModule,
	],
	providers: [AuthService, LocalStrategy, JwtStrategy],
	exports: [AuthService],
})
export class AuthModule {}
