import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const UserContext = createParamDecorator((context: ExecutionContext) => {
	const ctx = GqlExecutionContext.create(context);
	return ctx.getContext().user;
});
