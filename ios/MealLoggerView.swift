import SwiftUI

struct MealLoggerView: View {
    @EnvironmentObject private var apiClient: APIClient
    @State private var draft = ""
    @State private var state = MealAssistantState.empty
    @State private var messages: [ChatTranscriptMessage] = [
        ChatTranscriptMessage(role: .assistant, text: "Hey, what did you eat today?")
    ]
    @State private var isSending = false
    @State private var lastFailedMessage: String?
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(messages) { message in
                            ChatBubble(message: message)
                                .id(message.id)
                        }

                        if isSending {
                            HStack(spacing: 8) {
                                ProgressView()
                                Text("Thinking")
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 8)
                        }

                        if !state.currentMealItems.isEmpty {
                            ReviewBeforeSaveCard(state: state, saveAction: saveMeal)
                                .padding(.top, 8)
                        }
                    }
                    .padding()
                }
                .onChange(of: messages.count) {
                    if let last = messages.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }

            if let errorMessage {
                HStack {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                    Spacer()
                    if lastFailedMessage != nil {
                        Button("Retry") {
                            retryLastMessage()
                        }
                        .disabled(isSending)
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
            }

            HStack(spacing: 10) {
                TextField("Tell me what you ate", text: $draft, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1...4)
                    .disabled(isSending)
                    .submitLabel(.send)
                    .onSubmit(sendDraft)

                Button(action: sendDraft) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 30))
                }
                .disabled(!canSend)
                .accessibilityLabel("Send meal message")
            }
            .padding()
            .background(.bar)
        }
        .navigationTitle("Log")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var canSend: Bool {
        !isSending && !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func sendDraft() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSending else { return }
        draft = ""
        sendMessage(text)
    }

    private func retryLastMessage() {
        guard let lastFailedMessage, !isSending else { return }
        sendMessage(lastFailedMessage)
    }

    private func sendMessage(_ text: String) {
        isSending = true
        errorMessage = nil
        lastFailedMessage = nil
        messages.append(ChatTranscriptMessage(role: .user, text: text))

        Task {
            do {
                let request = MealAssistantRequest(
                    message: text,
                    state: state,
                    context: MealAssistantContext(),
                    conversationHistory: messages.map { ChatTranscriptMessage(role: $0.role, text: $0.text) }
                )
                let response = try await apiClient.sendMealAssistantMessage(request)
                state = response.nextState
                messages.append(ChatTranscriptMessage(role: .assistant, text: response.assistantReply))
            } catch {
                lastFailedMessage = text
                errorMessage = error.localizedDescription
            }
            isSending = false
        }
    }

    private func saveMeal() {
        guard !state.currentMealItems.isEmpty, !isSending else { return }
        isSending = true
        errorMessage = nil

        Task {
            do {
                let request = SaveMealRequest(
                    mealType: state.mealType,
                    confidenceScore: state.confidenceScore,
                    rawText: state.currentMealText,
                    notes: nil,
                    date: nil,
                    sourceReusableMealId: state.sourceReusableMealId,
                    items: state.currentMealItems
                )
                _ = try await apiClient.saveMeal(request)
                state.saved = true
                messages.append(ChatTranscriptMessage(role: .assistant, text: "Saved. Ready for the next one?"))
            } catch {
                errorMessage = error.localizedDescription
            }
            isSending = false
        }
    }
}

private struct ChatBubble: View {
    var message: ChatTranscriptMessage

    var body: some View {
        HStack {
            if message.role == .assistant {
                bubble
                Spacer(minLength: 44)
            } else {
                Spacer(minLength: 44)
                bubble
            }
        }
    }

    private var bubble: some View {
        Text(message.text)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .foregroundStyle(message.role == .assistant ? .primary : .white)
            .background(message.role == .assistant ? Color(.secondarySystemBackground) : Color.accentColor)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

private struct ReviewBeforeSaveCard: View {
    var state: MealAssistantState
    var saveAction: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Review before saving")
                .font(.headline)
            ForEach(state.currentMealItems) { item in
                HStack {
                    Text(item.foodName)
                    Spacer()
                    Text("\(Int(item.calories)) cal")
                        .foregroundStyle(.secondary)
                }
            }
            Button("Save meal", action: saveAction)
                .buttonStyle(.borderedProminent)
        }
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

#Preview {
    NavigationStack {
        MealLoggerView()
            .environmentObject(APIClient())
    }
}
