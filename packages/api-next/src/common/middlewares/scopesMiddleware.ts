import {
	Extensions,
	FieldMiddleware,
	MiddlewareContext,
	NextFn,
} from '@nestjs/graphql';

export enum ScopesEnum {
	login = 'login',
	admin = 'admin',
}

export function LoggedInField(): MethodDecorator &
	ClassDecorator &
	PropertyDecorator {
	return Extensions({ scopes: [ScopesEnum.login] });
}

export function AdminField(): MethodDecorator &
	ClassDecorator &
	PropertyDecorator {
	return Extensions({ scopes: [ScopesEnum.admin] });
}

export function FieldScopes(
	...args: string[] | ScopesEnum[]
): MethodDecorator & ClassDecorator & PropertyDecorator {
	return Extensions({ scopes: [...args] });
}

export const scopesMiddleware: FieldMiddleware = async (
	ctx: MiddlewareContext,
	next: NextFn,
) => {
	const { info } = ctx;
	const { fieldName } = info;
	const extensions = info.parentType.getFields()[fieldName].extensions;

	// check if the field has the scope extension
	if (!extensions || !extensions.scopes) {
		return await next();
	}

	for (const scopeName of extensions.scopes as ScopesEnum[]) {
		switch (scopeName) {
			case ScopesEnum.admin:
				if (!ctx.context.user?.admin) {
					return null;
				}
				return await next(); // admin takes precedence over other scopes
			case ScopesEnum.login:
				if (!ctx.context.user) {
					return null;
				}
				break;
			default:
				break;
		}
	}

	return await next();
};
