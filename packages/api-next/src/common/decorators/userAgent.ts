import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const UserAgent = createParamDecorator(
	(data: unknown, context: ExecutionContext) => {
		const ctx = GqlExecutionContext.create(context);
		return ctx.getContext().headers['user-agent'];
	},
);
