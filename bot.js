const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');

// ─── CONFIG (Usando Variáveis de Ambiente para Segurança) ────────────────────
const TOKEN        = process.env.DISCORD_TOKEN;
const MASTER_KEY   = process.env.MASTER_KEY;
const BASE_URL     = process.env.BASE_URL || 'https://ruan.arifi.site';
const CLIENT_ID    = process.env.CLIENT_ID; 
// ───────────────────────────────────────────────────────────────────────────

if (!TOKEN || !MASTER_KEY || !CLIENT_ID) {
  console.error('❌ ERRO: As variáveis DISCORD_TOKEN, MASTER_KEY e CLIENT_ID precisam ser configuradas na Railway!');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ── Registrar slash command ─────────────────────────────────────────────────
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('exibir')
      .setDescription('Exibe o painel de atualização de IP da sua key')
      .toJSON()
  ];

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('📡 Registrando comando /exibir...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Comando registrado com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao registrar comando:', err);
  }
}

// ── Handler: /exibir ────────────────────────────────────────────────────────
async function handleExibir(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🔑  Painel de Atualização de IP')
    .setDescription(
      '> Clique no botão abaixo para atualizar o IP vinculado à sua key.\n\n' +
      '**Preencha os campos:**\n' +
      '• `Sua Key` — a chave gerada que você recebeu\n' +
      '• `Novo IP` — o IP que deseja vincular\n\n' +
      '_Apenas o dono da key pode alterá-la._'
    )
    .setColor(0x5865F2)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('abrir_modal_ip')
      .setLabel('🔄  Atualizar IP')
      .setStyle(ButtonStyle.Primary)
  );

  // Removido o ephemeral: true para o painel ser público e permanente
  await interaction.reply({ embeds: [embed], components: [row] });
}

// ── Handler: botão → abre modal ─────────────────────────────────────────────
async function handleAbrirModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('modal_atualizar_ip')
    .setTitle('Atualizar IP da Key');

  const keyInput = new TextInputBuilder()
    .setCustomId('campo_key')
    .setLabel('Sua Key')
    .setPlaceholder('Ex: ABCDEF-123456-GHIJKL')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const ipInput = new TextInputBuilder()
    .setCustomId('campo_ip')
    .setLabel('Novo IP')
    .setPlaceholder('Ex: 192.168.0.1')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(45);

  modal.addComponents(
    new ActionRowBuilder().addComponents(keyInput),
    new ActionRowBuilder().addComponents(ipInput)
  );

  await interaction.showModal(modal);
}

// ── Handler: submit do modal → chama API ────────────────────────────────────
async function handleModalSubmit(interaction) {
  // As respostas de processamento continuam privadas (ephemeral) para segurança
  await interaction.deferReply({ ephemeral: true });

  const userKey = interaction.fields.getTextInputValue('campo_key').trim();
  const newIp   = interaction.fields.getTextInputValue('campo_ip').trim();

  // Validação básica de IP (IPv4 e IPv6 simples)
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^[0-9a-fA-F:]{2,39}$/;
  if (!ipv4Regex.test(newIp) && !ipv6Regex.test(newIp)) {
    return interaction.editReply({
      embeds: [errorEmbed('IP inválido. Use o formato correto, ex: `192.168.0.1`')]
    });
  }

  const url = `${BASE_URL}/update?key=${encodeURIComponent(MASTER_KEY)}&generated_key=${encodeURIComponent(userKey)}&new_ip=${encodeURIComponent(newIp)}`;

  try {
    const res  = await fetch(url);
    const text = await res.text();

    let json = null;
    try { json = JSON.parse(text); } catch (_) { /* texto puro */ }

    const success = res.ok && (
      (json && (json.success || json.status === 'success' || json.message?.toLowerCase().includes('success'))) ||
      (!json && text.toLowerCase().includes('success'))
    );

    if (success) {
      const embed = new EmbedBuilder()
        .setTitle('✅  IP Atualizado com Sucesso!')
        .addFields(
          { name: 'Key',    value: `\`${userKey}\``, inline: true },
          { name: 'Novo IP', value: `\`${newIp}\``,  inline: true }
        )
        .setColor(0x57F287)
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } else {
      const msg = json?.message || json?.error || text || 'Resposta inesperada da API.';
      return interaction.editReply({ embeds: [errorEmbed(`Erro da API: ${msg}`)] });
    }

  } catch (err) {
    console.error('Erro ao chamar API:', err);
    return interaction.editReply({
      embeds: [errorEmbed('Não foi possível conectar à API. Tente novamente mais tarde.')]
    });
  }
}

// ── Embed de erro ─────────────────────────────────────────────────────────
function errorEmbed(msg) {
  return new EmbedBuilder()
    .setTitle('❌  Erro')
    .setDescription(msg)
    .setColor(0xED4245)
    .setTimestamp();
}

// ── Eventos do client ─────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`🤖 Bot online como ${client.user.tag}`);
  await registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'exibir') {
      return handleExibir(interaction);
    }
    if (interaction.isButton() && interaction.customId === 'abrir_modal_ip') {
      return handleAbrirModal(interaction);
    }
    if (interaction.isModalSubmit() && interaction.customId === 'modal_atualizar_ip') {
      return handleModalSubmit(interaction);
    }
  } catch (err) {
    console.error('Erro no handler:', err);
    const reply = { content: '❌ Ocorreu um erro interno.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      interaction.editReply(reply).catch(() => {});
    } else {
      interaction.reply(reply).catch(() => {});
    }
  }
});

client.login(TOKEN);
