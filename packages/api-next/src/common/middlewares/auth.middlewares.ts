import { FieldMiddleware, MiddlewareContext, NextFn } from '@nestjs/graphql';

export enum Scopes {
	login = 'login',
	admin = 'admin',
}

export const scopeMiddleware: FieldMiddleware = async (
	ctx: MiddlewareContext,
	next: NextFn,
) => {
	const { info } = ctx;
	const { fieldName } = info;
	const extensions = info.parentType.getFields()[fieldName].extensions;

	console.log('ctx', ctx.context.req.user);

	// check if the field has the scope extension
	if (!extensions || !extensions.scopes) {
		return await next();
	}

	for (const scopeName of extensions.scopes as Scopes[]) {
		switch (scopeName) {
			case Scopes.login:
				if (!ctx.context.req.user) {
					return null;
				}
				break;
			case Scopes.admin:
				if (!ctx.context.req.user?.admin) {
					return null;
				}
				break;
			default:
				break;
		}
	}

	return await next();
};
