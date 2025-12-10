const EfiPaySdk = require('sdk-node-apis-efi');
require('dotenv').config();
const fs = require('fs');

/**
 * Inicializa e configura o SDK da Efí Pay.
 * A configuração é montada dinamicamente com base nas variáveis de ambiente.
 */
const initializeEfiPay = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  // O caminho para o certificado será fornecido pela variável de ambiente 'EFI_CERTIFICATE_PATH'.
  // No Render, este será o caminho do "Secret File".
  // Para desenvolvimento local, você pode apontar para o arquivo no seu computador.
  const certificatePath = process.env.EFI_CERTIFICATE_PATH;
  
  if (!certificatePath) {
    throw new Error('A variável de ambiente EFI_CERTIFICATE_PATH não está definida.');
  }

  // Adiciona uma verificação para ver se o arquivo de certificado existe no caminho fornecido.
  if (!fs.existsSync(certificatePath)) {
    console.error(`[Efí Pay Service] ERRO CRÍTICO: O arquivo de certificado não foi encontrado no caminho: ${certificatePath}`);
    throw new Error(`Arquivo de certificado não encontrado. Verifique o valor da variável de ambiente EFI_CERTIFICATE_PATH.`);
  }
  
  // Validação robusta das credenciais com base no ambiente
  if (isProduction) {
    if (!process.env.EFI_PROD_CLIENT_ID || !process.env.EFI_PROD_CLIENT_SECRET) {
      throw new Error('Credenciais de PRODUÇÃO da Efí (EFI_PROD_CLIENT_ID, EFI_PROD_CLIENT_SECRET) não estão definidas no ambiente.');
    }
  } else {
    if (!process.env.EFI_HOMOLOG_CLIENT_ID || !process.env.EFI_HOMOLOG_CLIENT_SECRET) {
      throw new Error('Credenciais de HOMOLOGAÇÃO da Efí (EFI_HOMOLOG_CLIENT_ID, EFI_HOMOLOG_CLIENT_SECRET) não estão definidas no ambiente.');
    }
  }

  const options = {
    client_id: isProduction ? process.env.EFI_PROD_CLIENT_ID : process.env.EFI_HOMOLOG_CLIENT_ID,
    client_secret: isProduction ? process.env.EFI_PROD_CLIENT_SECRET : process.env.EFI_HOMOLOG_CLIENT_SECRET,
    sandbox: !isProduction,
    certificate: certificatePath,
  };

  // Log para depuração, confirmando as opções usadas para inicializar o SDK
  console.log(`[Efí Pay Service] Inicializando SDK em modo ${options.sandbox ? 'Sandbox' : 'Produção'}. Client ID: ${options.client_id ? 'Definido' : '***NÃO DEFINIDO***'}`);

  // Retorna uma nova instância do SDK já configurada
  return new EfiPaySdk(options);
};

const EfiPay = {
  createPixCharge: async (total, expirationInSeconds) => {
    const efi = initializeEfiPay();

    try {
      // Corpo da requisição para criar a cobrança imediata
      const body = {
        calendario: {
          expiracao: expirationInSeconds.toString(),
        },
        valor: {
          // A API da Efí espera o valor como uma string com duas casas decimais.
          original: total.toFixed(2),
        },
        chave: process.env.EFI_PIX_KEY, // Sua chave PIX cadastrada na Efí
        solicitacaoPagador: `Pedido Gamer Store R$${total.toFixed(2)}`,
      };

      console.log("Enviando requisição para a API da Efí...");

      // Chama o método do SDK para criar a cobrança. O primeiro parâmetro não é necessário.
      const pixChargeResponse = await efi.pixCreateImmediateCharge(body);

      // Agora, precisamos buscar os detalhes da cobrança (incluindo o QR Code)
      const qrCodeResponse = await efi.pixGenerateQRCode({ txid: pixChargeResponse.txid });

      console.log("Cobrança PIX e QR Code gerados com sucesso!");

      // Retorna um objeto unificado com as informações necessárias para o frontend
      return {
        txid: pixChargeResponse.txid,
        pixCopiaECola: qrCodeResponse.pix_copia_e_cola,
        imagemQrcode: qrCodeResponse.imagem_qrcode,
      };

    } catch (error) {
      // O SDK oficial da Efí retorna erros mais detalhados
      console.error('Erro ao gerar cobrança Efí:', error.error_description || error.erros || error);
      throw new Error('Falha na comunicação com a API de pagamento.');
    }
  },
};

module.exports = { EfiPay };