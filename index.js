#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const PDFParser = require('pdf2json');
const createHtml = require('./createHtml.js');
const readline = require('readline');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer)));
}

function lerPDF(filePath) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();

        pdfParser.on('pdfParser_dataError', err => reject(err.parserError));
        pdfParser.on('pdfParser_dataReady', pdfData => resolve(pdfData));

        pdfParser.loadPDF(filePath);
    });
}

// Converte valor no formato brasileiro (ex: 1.958,00) para número.
// Retorna '' se o texto não estiver no formato esperado, para a nota ir para os erros.
function converterValorBR(texto) {
    const valor = texto.trim();
    if (!/^\d{1,3}(\.\d{3})*,\d{2}$/.test(valor)) return '';
    return Number.parseFloat(valor.replace(/\./g, '').replace(',', '.'));
}

(async () => {

    const format = 'DD-MM-YYYY';
    const startDateInput = await ask("Digite a data inicial (DD-MM-YYYY): ");
    const endDateInput = await ask("Digite a data final (DD-MM-YYYY): ");
    rl.close();

    const startDate = dayjs(startDateInput, format);
    const endDate = dayjs(endDateInput, format);

    if (!startDate.isValid() || !endDate.isValid()) {
        console.error("Uma ou mais datas são inválidas. Use o formato DD-MM-YYYY.");
        process.exit(1);
    }

    const notas = [];
    const erros = [];

    const arquivos = fs.readdirSync(process.cwd()).filter(f => f.toLowerCase().endsWith('.pdf'));

    for (const arquivo of arquivos) {
        const caminho = path.join(process.cwd(), arquivo);
        const pdfData = await lerPDF(caminho);

        let cnpj = '';
        let numeroNota = '';
        let valorNota = '';
        let data = '';

        const page = pdfData.Pages[0];
        for (const item of page.Texts) {
            // Posição do numero da nota
            if (item.x >= 32 && item.x <= 33 && item.y >= 1 && item.y <= 2) {
                numeroNota = decodeURIComponent(item.R[0].T);
            }

            // Posição do CNPJ
            if (item.x >= 22 && item.x <= 23 && item.y >= 13 && item.y <= 14) {
                cnpj = decodeURIComponent(item.R[0].T);
            }

            // Posição da data da nota
            if (item.x >= 31 && item.x <= 32 && item.y >= 13 && item.y <= 14) {
                data = decodeURIComponent(item.R[0].T);
            }

            // Posição do valor total da nota
            // O valor é alinhado à direita, então valores maiores começam mais à esquerda
            if (item.x >= 32 && item.x <= 36 && item.y >= 21 && item.y <= 22.5) {
                valorNota = converterValorBR(decodeURIComponent(item.R[0].T));
            }

            // console.log(item.x, item.y, item.R)
        }

        const dataFormatada = data.replace(/(\d{2})\/(\d{2})\/(\d{4}).*/, "$1-$2-$3");
        const checkDate = dayjs(dataFormatada, format);
        const isBetween = checkDate.isSame(startDate) || checkDate.isSame(endDate) || (checkDate.isAfter(startDate) && checkDate.isBefore(endDate));

        if (!isBetween) continue;

        if (numeroNota && valorNota && data) {
            notas.push({
                cnpj,
                numeroNota,
                valorNota: valorNota || 0,
                data,
            });
        } else {
            erros.push({
                arquivo,
                cnpj,
                numeroNota,
                valorNota,
                data
            });
        }
    }

    const relatorios = [];
    notas.forEach(nota => {
        const relatorioExistente = relatorios.find(rel => rel.cnpj == nota.cnpj);
        if (relatorioExistente) {
            relatorioExistente.notas.push(nota);
        } else {
            relatorios.push({
                cnpj: nota.cnpj,
                notas: [nota],
                erros: [],
                total: 0,
            })
        }
    });

    erros.forEach(erro => {
        const relatorioExistente = relatorios.find(rel => rel.cnpj == erro.cnpj);
        if (relatorioExistente) {
            relatorioExistente.erros.push(erro);
        } else {
            relatorios.push({
                cnpj: erro.cnpj,
                notas: [],
                erros: [erro],
                total: 0,
            })
        }
    });

    relatorios.forEach(relatorio => {
        // Soma em centavos inteiros para evitar erros de ponto flutuante (ex: 0.1 + 0.2)
        const totalCentavos = relatorio.notas.reduce((prev, curr) => prev + Math.round(curr.valorNota * 100), 0);
        relatorio.total = totalCentavos / 100;
    })

    try {
        const pastaDestino = path.join(process.cwd(), 'relatorios');
    
        if (!fs.existsSync(pastaDestino)) {
          fs.mkdirSync(pastaDestino, { recursive: true });
        }
    
        const currDate = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const dateFormat = currDate.split(/[/,:\s]+/).join('-');
    
        fs.writeFileSync(path.join(pastaDestino, `relatorios_${dateFormat}.json`), JSON.stringify(relatorios), 'utf-8');
        fs.writeFileSync(path.join(pastaDestino, `relatorios_${dateFormat}.html`), createHtml(relatorios), 'utf-8');
    } catch (error) {
        console.log(error)
    }

    console.log("Relatorios criados com sucesso!");

    // Aguarda o usuário apertar Enter para fechar
    const pause = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    pause.question('\nPressione Enter para sair...', () => {
        pause.close();
    });
})().catch(error => {
    console.error('\nOcorreu um erro ao gerar os relatorios:');
    console.error(error);

    // Mantém a janela aberta para o usuário conseguir ler o erro
    const pause = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    pause.question('\nPressione Enter para sair...', () => {
        pause.close();
        process.exit(1);
    });
});
