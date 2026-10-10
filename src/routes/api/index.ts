import { createFileRoute } from "@tanstack/react-router";
import { Genre } from "#/utils/types.ts";

export const Route = createFileRoute("/api/")({
  server: {
    handlers: {
      GET: () => {
        const response = {
          id: process.env.SERVER_ID?.trim() || "mankai-server",
          authenticationEnabled: true,
          editorEnabled: true,
          name: "Mankai Server",
          availableGenres: Object.values(Genre).filter((g) => g !== Genre.All),
          description:
            "A self-hosted manga server compatible with the Mankai HTTP API",
          authors: ["Travis XU"],
          repository: "https://github.com/nohackjustnoobb/mankai-server",
          capabilities: [
            "onlineCheck",
            "suggestions",
            "list",
            "listByGenre",
            "listByStatus",
            "search",
            "searchByGenre",
            "searchByStatus",
            "searchByAuthor",
            "mangaDetails",
            "batchMangas",
            "chapter",
            "image",
          ],
        };

        return Response.json(response);
      },
    },
  },
});
