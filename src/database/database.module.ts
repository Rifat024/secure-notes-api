import { Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppConfig } from '../config/app.config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<AppConfig>('app').mongoUri,
        autoIndex: false,
        serverSelectionTimeoutMS: 10000,
      }),
    }),
  ],
})
export class DatabaseModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  /** Aligns the database with the schema.index() declarations, dropping any index no longer declared. */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await Promise.all(Object.values(this.connection.models).map((model) => model.syncIndexes()));
    } catch (error) {
      this.logger.error('Index synchronisation failed', error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }
}
