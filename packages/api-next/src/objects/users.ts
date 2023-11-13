import { Module } from '@nestjs/common';
import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class User {
	@Field(() => ID)
	id: string;
	majorId: string;
	uid: string;
	createAt: Date;

	schoolServer: string;
	schoolUid: string;
	schoolEmail: string;

	email: string;
	othersEmails: string[];
	firstName: string;

	// major: Major;
	// minor:Minor;

	graduationYear: number;
	apprentice: boolean;
	address: string;
	birthday: Date;
	description: string;
	nickname: string;
	phone: string;
	pictureFile: string;
	// links: Link[];
	godparentId?: string;
	cededImageRightsToTVn7: boolean;
	// enabledNotificationChannels NotificationChannel[];

	// permissions
	admin: boolean;
	canEditUsers: boolean;
	canEditGroups: boolean;
	canAccessDocuments: boolean;
}

@Module({})
export class UsersModule {}
