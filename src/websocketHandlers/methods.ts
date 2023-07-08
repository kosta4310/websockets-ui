import { MyWebSocket, UsersData } from "./parseMsg";
import { WebSocket } from "ws";
import { StatusAttack } from "./statusAttack";
import { wss } from "../../src/ws_server";

export function createPlayer(
  idPlayer: number,
  name: string,
  password: string,
  ws: WebSocket
) {
  // db.set(ws, {
  //   name,
  //   password,
  //   index: idPlayer,
  //   idGame: 0,
  // });

  const responseData = {
    name: name,
    index: idPlayer,
    error: false,
    errorText: "something",
  };
  const stringifiedData = JSON.stringify(responseData);
  const response = JSON.stringify({
    type: "reg",
    data: stringifiedData,
    id: 0,
  });
  ws.send(response);
}

export function createGame(idGame: number, idPlayer: number, ws: WebSocket) {
  // const updateUserData = { ...db.get(ws), idGame } as UsersData;
  // db.set(ws, updateUserData);
  const responseData = JSON.stringify({
    idGame,
    idPlayer,
  });
  const response = JSON.stringify({
    type: "create_game",
    data: responseData,
    id: 0,
  });

  ws.send(response);
}

export function updateRoom(
  idGame: number,
  name: string,
  index: number,
  ws: WebSocket
) {
  // let iterator = db.keys();

  for (const client of wss.clients) {
    if (client !== ws) {
      const responseUpdateRoom = updateDataRoom(idGame, [
        {
          name,
          index,
        },
      ]);
      client.send(JSON.stringify(responseUpdateRoom));
    }
  }
}

export function startGame(ships: Array<any>, index: number, ws: WebSocket) {
  const responseData = JSON.stringify({
    ships,
    currentPlayerIndex: index,
  });

  const response = JSON.stringify({
    type: "start_game",
    data: responseData,
    id: 0,
  });

  ws.send(response);
}

export function changePlayersTurn(
  currentPlayer: number,
  arrayWs: Array<WebSocket>
) {
  const responseData = JSON.stringify({ currentPlayer });
  const response = JSON.stringify({
    type: "turn",
    data: responseData,
    id: 0,
  });

  arrayWs.map((ws) => ws.send(response));
}

export function attack(
  position: { x: number; y: number },
  currentPlayer: number,
  status: StatusAttack,
  arrayWs: Array<WebSocket>
) {
  const responseData = JSON.stringify({
    position,
    currentPlayer,
    status,
  });

  const response = JSON.stringify({
    type: "attack",
    data: responseData,
    id: 0,
  });
  arrayWs.forEach((client) => client.send(response));
}

export function emptyUpdateRoom(arrayWs: Array<MyWebSocket>) {
  const responseData = JSON.stringify([]);
  const response = JSON.stringify({
    type: "update_room",
    data: responseData,

    id: 0,
  });

  arrayWs.forEach((client) => client.send(response));
}

function updateDataRoom(
  roomId: number,
  roomUsers: Array<{
    name: string;
    index: number;
  }>
) {
  return {
    type: "update_room",
    data: JSON.stringify([
      {
        roomId,
        roomUsers,
      },
    ]),
    id: 0,
  };
}

export function finish(winPlayer: number, arrayWs: Array<WebSocket>) {
  const responseData = JSON.stringify({ winPlayer });
  const response = JSON.stringify({
    type: "finish",
    data: responseData,
    id: 0,
  });

  arrayWs.forEach((client) => client.send(response));
}

export function updateWinners(
  winners: Array<{ name: string; wins: number }>,
  arrayWs: Array<WebSocket>
) {
  const responseData = JSON.stringify(winners);
  const response = JSON.stringify({
    type: "update_winners",
    data: responseData,
    id: 0,
  });

  arrayWs.forEach((client) => client.send(response));
}
