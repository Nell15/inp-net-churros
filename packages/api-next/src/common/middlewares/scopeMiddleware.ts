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

export function LoggedIn(): MethodDecorator &
	ClassDecorator &
	PropertyDecorator {
	return Extensions({ scopes: [ScopesEnum.login] });
}

export function Admin(): MethodDecorator & ClassDecorator & PropertyDecorator {
	return Extensions({ scopes: [ScopesEnum.admin] });
}

export function Scopes(
	...args: string[] | ScopesEnum[]
): MethodDecorator & ClassDecorator & PropertyDecorator {
	return Extensions({ scopes: [...args] });
}

export const scopeMiddleware: FieldMiddleware = async (
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
			case ScopesEnum.login:
				if (!ctx.context.user) {
					return null;
				}
				break;
			case ScopesEnum.admin:
				if (!ctx.context.user?.admin) {
					return null;
				}
				break;
			default:
				break;
		}
	}

	return await next();
};
