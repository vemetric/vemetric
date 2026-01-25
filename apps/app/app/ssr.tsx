/// <reference types="vinxi/types/server" />
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server';

const fetch = createStartHandler(defaultStreamHandler);

export default { fetch };
