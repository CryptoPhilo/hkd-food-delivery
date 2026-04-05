import { Router, Request, Response } from 'express';
import logger from '../utils/logger';

const router = Router();

// SSE 연결 관리
const clients = new Map<string, Response>();

// SSE 연결
router.get('/connect', (req: Request, res: Response) => {
  const clientId = (req.query.clientId as string) || `client_${Date.now()}`;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  clients.set(clientId, res);
  logger.info(`[SSE] 클라이언트 연결: ${clientId}`);

  req.on('close', () => {
    clients.delete(clientId);
    logger.info(`[SSE] 클라이언트 연결 해제: ${clientId}`);
  });
});

// 특정 클라이언트에 이벤트 전송
export function sendSSEEvent(clientId: string, event: string, data: any): boolean {
  const client = clients.get(clientId);
  if (!client) return false;
  client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  return true;
}

// 전체 브로드캐스트
export function broadcastSSE(event: string, data: any): void {
  for (const [, client] of clients) {
    client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

export default router;
