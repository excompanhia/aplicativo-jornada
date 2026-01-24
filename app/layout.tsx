export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Mostra splash por 3s apenas 1x por “sessão” (até fechar e abrir o app).
  // Faz isso ANTES do React, evitando a piscada de landing.
  const inlineScript = `
(function () {
  try {
    var KEY = "jornada:splash:shown";
    var already = sessionStorage.getItem(KEY);
    var shouldShow = (already !== "true");

    if (!shouldShow) return;

    sessionStorage.setItem(KEY, "true");

    var splash = document.getElementById("jornada-splash");
    var app = document.getElementById("jornada-app");

    if (!splash || !app) return;

    // mostra splash imediatamente e esconde o app
    splash.style.display = "flex";
    app.style.visibility = "hidden";

    // depois de 3s, esconde splash e mostra app
    setTimeout(function () {
      splash.style.display = "none";
      app.style.visibility = "visible";
    }, 3000);
  } catch (e) {
    // se algo falhar, não bloqueia o app
  }
})();
`;

  return (
    <html lang="pt-BR">
      <head>
        <script dangerouslySetInnerHTML={{ __html: inlineScript }} />
      </head>

      <body
        style={{
          margin: 0,
          background: "#f2f2f2",
          display: "flex",
          justifyContent: "center",
        }}
      >
        {/* Splash server-rendered (sem flash) */}
        <div
          id="jornada-splash"
          style={{
            position: "fixed",
            inset: 0,
            background: "white",
            display: "none", // o script liga quando precisa
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999999,
          }}
        >
          <img
            src="/splash.png"
            alt="Jornada"
            style={{
              maxHeight: "70vh",
              maxWidth: "90vw",
              width: "auto",
              height: "auto",
            }}
          />
        </div>

        {/* App shell */}
        <div
          id="jornada-app"
          style={{
            width: "100%",
            maxWidth: 430,
            minHeight: "100vh",
            background: "white",
          }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
