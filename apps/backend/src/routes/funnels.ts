import { clickhouseEvent } from 'clickhouse';
import { projectProcedure, router } from '../utils/trpc';

export const funnelsRouter = router({
  getFunnelResults: projectProcedure.query(async (opts) => {
    const {
      ctx: { projectId },
    } = opts;

    // Get data from the last 90 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    return {
      funnelResults: await clickhouseEvent.getFunnelResults(
        projectId,
        [
          { type: 'pageview', pathname: '/p/*' },
          { type: 'event', name: 'ChangeColorMode' },
        ],
        startDate,
      ),
    };
  }),
});
