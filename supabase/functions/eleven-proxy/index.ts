import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const upgradeHeader = req.headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agent_id");
    const authToken = url.searchParams.get("token");

    if (!agentId || !authToken) {
      return new Response("Missing agent_id or token", { status: 400 });
    }

    // Validate the short-lived token (in production, verify JWT signature)
    if (!authToken.startsWith("token_")) {
      return new Response("Invalid token", { status: 401 });
    }

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      return new Response("ElevenLabs API key not configured", { status: 500 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);

    // Connect to ElevenLabs Conversational AI
    const elevenLabsWS = new WebSocket(`wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });

    // Forward messages from client to ElevenLabs
    socket.onmessage = (event) => {
      if (elevenLabsWS.readyState === WebSocket.OPEN) {
        elevenLabsWS.send(event.data);
      }
    };

    // Forward messages from ElevenLabs to client
    elevenLabsWS.onmessage = (event) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(event.data);
      }
    };

    // Handle connections
    elevenLabsWS.onopen = () => {
      console.log('Connected to ElevenLabs');
    };

    socket.onopen = () => {
      console.log('Client connected to proxy');
    };

    // Handle errors and disconnections
    elevenLabsWS.onerror = (error) => {
      console.error('ElevenLabs WebSocket error:', error);
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };

    socket.onerror = (error) => {
      console.error('Client WebSocket error:', error);
      if (elevenLabsWS.readyState === WebSocket.OPEN) {
        elevenLabsWS.close();
      }
    };

    elevenLabsWS.onclose = () => {
      console.log('ElevenLabs connection closed');
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };

    socket.onclose = () => {
      console.log('Client connection closed');
      if (elevenLabsWS.readyState === WebSocket.OPEN) {
        elevenLabsWS.close();
      }
    };

    return response;

  } catch (error) {
    console.error('Error in eleven-proxy:', error);
    return new Response("Proxy connection failed", { status: 500 });
  }
});