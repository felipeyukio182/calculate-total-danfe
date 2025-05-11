module.exports = (relatorios) => {
    return `
   <!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Notas por CNPJ</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      background: #f9f9f9;
    }

    h2 {
      color: #333;
      margin-top: 0px;
    }

    .cnpj-card {
      background: #fff;
      border: 1px solid #ccc;
      padding: 16px;
      margin-bottom: 20px;
      border-radius: 8px;
      box-shadow: 2px 2px 5px rgba(0,0,0,0.05);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    th, td {
      padding: 8px 12px;
      border: 1px solid #ddd;
      text-align: left;
    }

    th {
      background-color: #f0f0f0;
    }

    .total {
      font-weight: bold;
      margin-top: 10px;
    }

    .erros {
      color: red;
      font-style: italic;
    }
  </style>
</head>
<body>

  <h1>Relatório de Notas por CNPJ</h1>

  ${relatorios.map(relatorio => createTable(relatorio)).join('')}

</body>
</html>

`;
}

const createTable = (relatorio) => {
    return `
    <div class="cnpj-card">
    <h2>CNPJ: ${relatorio.cnpj}</h2>
    <table>
      <thead>
        <tr>
          <th>Número da Nota</th>
          <th>Valor da Nota (R$)</th>
          <th>Data de Emissão</th>
        </tr>
      </thead>
      <tbody>
      ${relatorio.notas.map(nota => `<tr><td>${nota.numeroNota}</td><td>${nota.valorNota}</td><td>${nota.data}</td></tr>`).join('')} 
      </tbody>
    </table>
    <div class="total">Total: R$ ${relatorio.total}</div>
  </div>
    `;
}