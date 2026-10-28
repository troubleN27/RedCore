import { z } from 'zod';

// Zod 4 проверяет поддержку JIT вызовом Function("") — под нашей CSP без 'unsafe-eval'
// это даёт нарушение CSP в консоли. В браузере схемы маленькие, JIT не нужен.
z.config({ jitless: true });
