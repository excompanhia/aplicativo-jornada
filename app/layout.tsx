export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Script roda NO FIM do body, então os elementos já existem.
  const inlineScript = `
(function () {
  try {
    var KEY = "jornada:splash:shown";
    var already = sessionStorage.getItem(KEY);
    var shouldShow = (already !== "true");

    var splash = document.getElementById("jornada-splash");
    var app = document.getElementById("jornada-app");

    if (!splash || !app) return;

    if (!shouldShow) {
      // não precisa splash -> garante app visível
      splash.style.display = "none";
      app.style.visibility = "visible";
      return;
    }

    sessionStorage.setItem(KEY, "true");

    // mostra splash e esconde app imediatamente
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
      <body
        style={{
          margin: 0,
          background: "#f2f2f2",
          display: "flex",
          justifyContent: "center",
        }}
      >
        {/* Splash (fica off por padrão; script liga quando precisa) */}
        <div
          id="jornada-splash"
          style={{
            position: "fixed",
            inset: 0,
            background: "white",
            display: "none",
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
            // começa visível por padrão; o script pode esconder por 3s
            visibility: "visible",
          }}
        >
          {children}
        </div>

        {/* Script no fim do body (sem falhar) */}
        <script dangerouslySetInnerHTML={{ __html: inlineScript }} />
      </body>
    </html>
  );
}
