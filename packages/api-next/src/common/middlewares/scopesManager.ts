/**
 * Routes and Resolvers Scopes Manager
 */
import { Reflector } from '@nestjs/core';
import { forEach } from 'lodash';
import { User } from '../../objects/users';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export enum ScopesEnum {
	Login = 'login',
	Admin = 'admin',
}

export const Scopes = Reflector.createDecorator<ScopesEnum[]>();

export const Login = () => Scopes([ScopesEnum.Login]);
export const Admin = () => Scopes([ScopesEnum.Admin]);

export class ScopesManager {
	/**
	 * Validate scopes in order to allow or not the request
	 *
	 * @param scopes
	 * @param context
	 * @throws UnauthorizedException
	 * @returns boolean
	 */
	public static validateScopes(
		scopes: ScopesEnum[],
		context: ExecutionContext,
	): boolean {
		if (!scopes) return true; // no scopes required early return

		const user = GqlExecutionContext.create(context).getContext().user as User;

		forEach(scopes, (scope) => {
			switch (scope) {
				case ScopesEnum.Login:
					if (!user) throw new UnauthorizedException();
					break;
				case ScopesEnum.Admin:
					if (!user?.admin) throw new UnauthorizedException();
					break;
				default:
					break;
			}
		});

		return true;
	}
}
