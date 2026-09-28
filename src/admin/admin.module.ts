import { Module } from '@nestjs/common';
import { NotesModule } from '../notes/notes.module.js';
import { UsersModule } from '../users/users.module.js';
import { AdminNotesController } from './admin-notes.controller.js';
import { AdminUsersController } from './admin-users.controller.js';

@Module({
  imports: [UsersModule, NotesModule],
  controllers: [AdminUsersController, AdminNotesController],
})
export class AdminModule {}
