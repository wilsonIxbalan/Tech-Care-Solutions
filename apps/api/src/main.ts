import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationError, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { ApiError } from './common/api-error';
import {
  ApiExceptionFilter,
  EnvelopeInterceptor,
  requestContext,
} from './common/http';
import { documentResponses } from './common/swagger';
import { AppModule } from './app.module';

function validationDetails(
  errors: ValidationError[],
  parent = '',
  result: Record<string, string[]> = {},
) {
  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) result[path] = Object.values(error.constraints);
    if (error.children?.length) validationDetails(error.children, path, result);
  }
  return result;
}
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const config = app.get(ConfigService);
  app.use(requestContext);
  app.useBodyParser('json', { limit: '1mb' });
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  const origins = config
    .getOrThrow<string>('FRONTEND_ORIGIN')
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: (errors) =>
        new ApiError(
          400,
          'VALIDACION',
          'Revisa los campos indicados.',
          validationDetails(errors),
        ),
    }),
  );
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('TechCare API')
      .setVersion('1')
      .setDescription(
        'Contrato /api/v1. Sesión JWT en cookie HttpOnly. Escrituras: JSON y Origin autorizado. Importes decimales como string.',
      )
      .addCookieAuth(
        config.get('NODE_ENV') === 'production'
          ? '__Host-techcare_session'
          : 'techcare_session',
        { type: 'apiKey', in: 'cookie' },
        'session',
      )
      .build(),
  );
  documentResponses(document);
  SwaggerModule.setup('docs', app, document);
  app.enableShutdownHooks();
  await app.listen(config.getOrThrow<number>('PORT'), '0.0.0.0');
}
void bootstrap();
