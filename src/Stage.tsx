import {ReactElement} from "react";
import {StageBase, StageResponse, InitialData, Message} from "@chub-ai/stages-ts";
import {LoadResponse} from "@chub-ai/stages-ts/dist/types/load";

/***
 Stage "Caixinhas de Opções"
 - Pede para a IA terminar cada resposta com opções dentro de <opcoes>...</opcoes>
 - Tira as opções do texto da história e mostra como caixinhas no painel do stage
 - Quando você digita só um número (ex: "2"), troca pelo texto da opção 2
 ***/

type MessageStateType = {
    opcoes: string[];
};

type ConfigType = any;
type InitStateType = any;
type ChatStateType = any;

// Instrução enviada para a IA em toda mensagem (não aparece no chat).
const INSTRUCAO = `[Instrução do sistema: ao final da sua resposta, ofereça de 2 a 4 opções curtas do que {{user}} pode fazer em seguida. Escreva cada opção em uma linha, dentro das tags exatamente assim:
<opcoes>
Primeira opção
Segunda opção
Terceira opção
</opcoes>
Não numere as opções e não escreva nada depois de </opcoes>.]`;

// Acha o bloco <opcoes>...</opcoes> (aceita também a tag sem fechar no final).
const REGEX_OPCOES = /<opcoes>([\s\S]*?)(<\/opcoes>|$)/i;

function extrairOpcoes(texto: string): { historia: string; opcoes: string[] } {
    const match = texto.match(REGEX_OPCOES);
    if (!match) {
        return {historia: texto, opcoes: []};
    }
    const opcoes = match[1]
        .split("\n")
        .map(linha => linha.replace(/^\s*(\[?\d+[\].)\-:]?|[-*•])\s*/, "").trim())
        .filter(linha => linha.length > 0)
        .slice(0, 6);
    const historia = texto.replace(REGEX_OPCOES, "").trim();
    return {historia, opcoes};
}

export class Stage extends StageBase<InitStateType, ChatStateType, MessageStateType, ConfigType> {

    opcoes: string[] = [];
    copiada: number | null = null;

    constructor(data: InitialData<InitStateType, ChatStateType, MessageStateType, ConfigType>) {
        super(data);
        const {messageState} = data;
        this.opcoes = messageState?.opcoes ?? [];
    }

    async load(): Promise<Partial<LoadResponse<InitStateType, ChatStateType, MessageStateType>>> {
        return {
            success: true,
            error: null,
            initState: null,
            chatState: null,
        };
    }

    async setState(state: MessageStateType): Promise<void> {
        // Chamado quando você troca de swipe ou volta numa mensagem antiga.
        this.opcoes = state?.opcoes ?? [];
        this.copiada = null;
    }

    async beforePrompt(userMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {
        const texto = userMessage.content.trim();
        let mensagemNova: string | null = null;

        // Se você digitou só um número, troca pelo texto da opção.
        const numero = texto.match(/^\[?(\d+)\]?$/);
        if (numero) {
            const indice = parseInt(numero[1], 10) - 1;
            if (indice >= 0 && indice < this.opcoes.length) {
                mensagemNova = this.opcoes[indice];
            }
        }

        // Limpa as caixinhas enquanto a IA pensa na próxima resposta.
        this.opcoes = [];
        this.copiada = null;

        return {
            stageDirections: INSTRUCAO,
            messageState: {opcoes: []},
            modifiedMessage: mensagemNova,
            systemMessage: null,
            error: null,
            chatState: null,
        };
    }

    async afterResponse(botMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {
        const {historia, opcoes} = extrairOpcoes(botMessage.content);
        this.opcoes = opcoes;
        this.copiada = null;

        return {
            stageDirections: null,
            messageState: {opcoes},
            // Só reescreve a mensagem se tinha opções nela.
            modifiedMessage: opcoes.length > 0 ? historia : null,
            error: null,
            systemMessage: null,
            chatState: null,
        };
    }

    async copiar(indice: number) {
        try {
            await navigator.clipboard.writeText(this.opcoes[indice]);
            this.copiada = indice;
        } catch {
            this.copiada = null;
        }
    }

    render(): ReactElement {
        const estiloCaixa = {
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
            textAlign: 'left' as const,
            width: '100%',
            padding: '12px 14px',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.06)',
            color: 'inherit',
            font: 'inherit',
            fontSize: '15px',
            lineHeight: 1.4,
            cursor: 'pointer',
        };
        const estiloNumero = {
            flexShrink: 0,
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontSize: '13px',
            fontWeight: 700,
            background: 'rgba(255,255,255,0.15)',
        };

        return <div style={{
            width: '100vw',
            height: '100vh',
            boxSizing: 'border-box',
            padding: '14px',
            overflowY: 'auto',
            color: '#eee',
            fontFamily: 'system-ui, sans-serif',
        }}>
            {this.opcoes.length === 0 ? (
                <div style={{opacity: 0.6, fontSize: '14px'}}>
                    As opções vão aparecer aqui depois da próxima resposta.
                </div>
            ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                    <div style={{opacity: 0.7, fontSize: '13px', marginBottom: '2px'}}>
                        Digite o número no chat para escolher:
                    </div>
                    {this.opcoes.map((opcao, i) => (
                        <button key={i} style={estiloCaixa} onClick={() => this.copiar(i)}>
                            <span style={estiloNumero}>{i + 1}</span>
                            <span>{opcao}{this.copiada === i ? '  ✓ copiado' : ''}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>;
    }
}
