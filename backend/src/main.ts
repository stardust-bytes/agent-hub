import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin: ['http://localhost:17135'],
  });

  const frontendDir = join(__dirname, '..', '..', 'frontend', 'dist');
  if (existsSync(frontendDir)) {
    app.useStaticAssets(frontendDir);
    app.use((req, res, next) => {
      if (!req.path.startsWith('/api') && req.method === 'GET') {
        res.sendFile(join(frontendDir, 'index.html'));
      } else {
        next();
      }
    });
  }

  await app.listen(process.env.PORT ?? 17135);
}
bootstrap();
