import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * This guard is used to check if the user is logged in.
 * As the jwt already has been checked by the JwtGuard, we only need to check
 * if the user is in the context.
 *
 * This one throws an error if the user is not logged in.
 */
@Injectable()
export class LoggedInGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		if (!GqlExecutionContext.create(context).getContext().user) {
			throw new UnauthorizedException();
		}

		return true;
	}
}
