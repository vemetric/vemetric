import { dbProject } from 'database';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from './logger';

export async function getProjectByToken(context: Context, bodyData: any) {
  const { req } = context;
  let token = req.header('Token');
  if (!token) {
    try {
      // we're falling back to reading it from the body because of beacon requests where we can't send it via the header
      token = bodyData['Token'];
    } catch (err) {
      logger.error({ err, 'req.path': req.path }, 'Failed to get token from body.');
    }

    if (!token) {
      throw new HTTPException(401);
    }
  }

  const project = await dbProject.findByToken(token);
  if (!project) {
    throw new HTTPException(401);
  }

  return project;
}
