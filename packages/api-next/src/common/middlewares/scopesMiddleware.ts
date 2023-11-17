import {
	Extensions,
	FieldMiddleware,
	MiddlewareContext,
	NextFn,
} from '@nestjs/graphql';

export enum FieldScopesEnum {
	login = 'login',
	admin = 'admin',
}

export function LoggedInField(): MethodDecorator &
	ClassDecorator &
	PropertyDecorator {
	return Extensions({ scopes: [FieldScopesEnum.login] });
}

export function AdminField(): MethodDecorator &
	ClassDecorator &
	PropertyDecorator {
	return Extensions({ scopes: [FieldScopesEnum.admin] });
}

export function FieldScopes(
	...args: string[] | FieldScopesEnum[]
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

	for (const scopeName of extensions.scopes as FieldScopesEnum[]) {
		switch (scopeName) {
			case FieldScopesEnum.admin:
				if (!ctx.context.user?.admin) {
					return null;
				}
				return await next(); // admin takes precedence over other scopes
			case FieldScopesEnum.login:
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
