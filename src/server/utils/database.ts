import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prismaOptions = {
  log: [
    {
      emit: 'event' as const,
      level: 'query' as const,
    },
    {
      emit: 'event' as const,
      level: 'error' as const,
    },
    {
      emit: 'event' as const,
      level: 'info' as const,
    },
    {
      emit: 'event' as const,
      level: 'warn' as const,
    },
  ],
};

export const prisma = globalThis.__prisma || new PrismaClient(prismaOptions);

// Log database events
prisma.$on('query', (e) => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Database Query', {
      query: e.query,
      params: e.params,
      duration: e.duration
    });
  }
});

prisma.$on('error', (e) => {
  logger.error('Database Error', e);
});

prisma.$on('info', (e) => {
  logger.info('Database Info', e);
});

prisma.$on('warn', (e) => {
  logger.warn('Database Warning', e);
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}