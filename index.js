const fs = require('fs');
const path = require('path');
const PDFParser = require('pdf2json');
const createHtml = require('./createHtml.js')

function lerPDF(filePath) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();

        pdfParser.on('pdfParser_dataError', err => reject(err.parserError));
        pdfParser.on('pdfParser_dataReady', pdfData => resolve(pdfData));

        pdfParser.loadPDF(filePath);
    });
}

async function lerPDFsSequencialmente(pastaPDFs) {
    const arquivos = fs.readdirSync(pastaPDFs).filter(f => f.endsWith('.pdf'));
    const resultados = [];

    for (const arquivo of arquivos) {
        const caminho = path.join(pastaPDFs, arquivo);
        try {
            const pdfData = await lerPDF(caminho);
            resultados.push({ nomeArquivo: arquivo, dados: pdfData });
        } catch (err) {
            console.error(`Erro ao ler ${arquivo}:`, err);
        }
    }

    return resultados;
}

(async () => {
    const relatorios = [];
    const caminhoBase = path.join(__dirname, "output");
    const subpastas = fs.readdirSync(caminhoBase).filter(nome => {
        const caminhoCompleto = path.join(caminhoBase, nome);
        return fs.statSync(caminhoCompleto).isDirectory();
    });

    for (const nomeSubpasta of subpastas) {
        const caminhoSubpasta = path.join(caminhoBase, nomeSubpasta);
        const resultados = await lerPDFsSequencialmente(caminhoSubpasta);

        const relatorio = {
            cnpj: nomeSubpasta?.replace("_", "/"),
            notas: [],
            total: 0,
            erros: [],
        };

        resultados.forEach(({ nomeArquivo, dados }) => {
            let numeroNota = '';
            let valorNota = '';
            let data = '';

            const page = dados.Pages[0];
            for (const item of page.Texts) {
                // Posição do numero da nota
                if (item.x >= 32 && item.x <= 33 && item.y >= 1 && item.y <= 2) {
                    numeroNota = decodeURIComponent(item.R[0].T);
                }

                // Posição da data da nota
                if (item.x >= 31 && item.x <= 32 && item.y >= 13 && item.y <= 14) {
                    data = decodeURIComponent(item.R[0].T);
                }

                // Posição do valor total da nota
                if (item.x >= 34 && item.x <= 35 && item.y >= 21 && item.y <= 22.5) {
                    valorNota = Number.parseFloat(decodeURIComponent(item.R[0].T));
                }

                // console.log(item.x, item.y, item.R)
            }

            if (numeroNota && valorNota && data) {
                relatorio.notas.push({
                    numeroNota,
                    valorNota: valorNota || 0,
                    data,
                });
            } else {
                relatorio.erros.push({
                    arquivo: nomeArquivo,
                    numeroNota,
                    valorNota,
                    data
                });
            }
        });

        const total = relatorio.notas.reduce((prev, curr) => prev + curr.valorNota, 0);
        relatorio.total = total;
        
        relatorios.push(relatorio);
    }

    const pastaDestino = path.join(__dirname, 'relatorios');
    if (!fs.existsSync(pastaDestino)) {
      fs.mkdirSync(pastaDestino, { recursive: true });
    }

    const currDate = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const dateFormat = currDate.split(/[/,:\s]+/).join('-');

    fs.writeFileSync(path.join(pastaDestino, `relatorios_${dateFormat}.json`), JSON.stringify(relatorios), 'utf-8');
    fs.writeFileSync(path.join(pastaDestino, `relatorios_${dateFormat}.html`), createHtml(relatorios), 'utf-8');
    console.log("Relatorios criados com sucesso!")
})();
