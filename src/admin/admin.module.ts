import { Module } from '@nestjs/common';
import { NotesModule } from '../notes/notes.module';
import { UsersModule } from '../users/users.module';
import { AdminNotesController } from './admin-notes.controller';
import { AdminUsersController } from './admin-users.controller';

@Module({
  imports: [UsersModule, NotesModule],
  controllers: [AdminUsersController, AdminNotesController],
})
export class AdminModule {}
