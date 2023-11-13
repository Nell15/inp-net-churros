import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { SchoolsModule } from './objects/schools';
import { CredentialsModule } from './objects/credentials';
import { Request } from 'express';
import { AuthModule } from './auth';

@Module({
	imports: [
		GraphQLModule.forRoot<ApolloDriverConfig>({
			driver: ApolloDriver,
			autoSchemaFile: true,
			context: ({ req }: { req: Request }): Request => {
				return req;
			},
		}),
		AuthModule,
		SchoolsModule,
		CredentialsModule,
	],
})
export class AppModule {}

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	await app.listen(4000);
}

bootstrap();
