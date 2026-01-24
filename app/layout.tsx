import SplashGate from "./components/SplashGate";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          background: "#f2f2f2",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 430,
            minHeight: "100vh",
            background: "white",
          }}
        >
          <SplashGate seconds={3}>{children}</SplashGate>
        </div>
      </body>
    </html>
  );
}
