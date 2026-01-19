export type Station = {
  id: string;
  title: string;
  text: string;
  images: string[]; // lista de caminhos de imagens (3 a 5)
  audioSrc: string; // caminho do áudio da estação
};

export const stations: Station[] = [
  {
    id: "1",
  title: "Estação 01",
  text: "Descrição breve da estação 01.",
  images: ["/img/1-1.jpg", "/img/1-2.jpg", "/img/1-3.jpg"],
  audioSrc: "/audio/s1.mp3",
  },
  {
    id: "2",
    title: "Estação 02",
    text: "Descrição breve da estação 02.",
    images: ["/img/1-1.jpg", "/img/1-2.jpg", "/img/1-3.jpg"],
    audioSrc: "/audio/s1.mp3",
  },
  {
    id: "3",
    title: "Estação 03",
    text: "Descrição breve da estação 03.",
    images: ["/img/1-1.jpg", "/img/1-2.jpg", "/img/1-3.jpg"],
    audioSrc: "/audio/s1.mp3",
  },
  {
    id: "4",
    title: "Estação 04",
    text: "Descrição breve da estação 04.",
    images: ["/img/1-1.jpg", "/img/1-2.jpg", "/img/1-3.jpg"],
    audioSrc: "/audio/s1.mp3",
  },
  {
    id: "5",
    title: "Estação 05",
    text: "Descrição breve da estação 05.",
    images: ["/img/1-1.jpg", "/img/1-2.jpg", "/img/1-3.jpg"],
    audioSrc: "/audio/s1.mp3",
  },
  {
    id: "6",
    title: "Estação 06",
    text: "Descrição breve da estação 06.",
    images: ["/img/1-1.jpg", "/img/1-2.jpg", "/img/1-3.jpg"],
    audioSrc: "/audio/s1.mp3",
  },
  {
    id: "7",
    title: "Estação 07",
    text: "Descrição breve da estação 07.",
    images: ["/img/1-1.jpg", "/img/1-2.jpg", "/img/1-3.jpg"],
    audioSrc: "/audio/s1.mp3",
  },
  {
    id: "8",
    title: "Estação 08",
    text: "Descrição breve da estação 08.",
    images: ["/img/1-1.jpg", "/img/1-2.jpg", "/img/1-3.jpg"],
    audioSrc: "/audio/s1.mp3",
  },
  {
    id: "9",
    title: "Estação 09",
    text: "Descrição breve da estação 09.",
    images: ["/img/1-1.jpg", "/img/1-2.jpg", "/img/1-3.jpg"],
    audioSrc: "/audio/s1.mp3",
  },
  {
    id: "10",
    title: "Estação 10",
    text: "Descrição breve da estação 10.",
    images: ["/img/1-1.jpg", "/img/1-2.jpg", "/img/1-3.jpg"],
    audioSrc: "/audio/s1.mp3",
  },
];
