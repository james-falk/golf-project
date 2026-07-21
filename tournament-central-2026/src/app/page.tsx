import TournamentConsole from "@/components/TournamentConsole";
import { ClubLoreProvider } from "@/components/ClubLore";

export default function Home() {
  return <ClubLoreProvider><TournamentConsole /></ClubLoreProvider>;
}
