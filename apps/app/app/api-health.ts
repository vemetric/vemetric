import { eventHandler } from 'vinxi/http';

export default eventHandler(() => new Response('', { status: 200 }));
