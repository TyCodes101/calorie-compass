//
//  LogChatView.swift
//  CalorieCompass
//
//  Native chat logger main view for Phase 2A
//
import SwiftUI

struct LogChatView: View {
    @State private var messages: [(role: String, text: String)] = []
    @State private var inputText = ""
    @State private var isLoading = false
    @State private var error: String?
    @State private var assistantState: String? = nil
    
    var body: some View {
        VStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(Array(messages.enumerated()), id: \ .offset) { index, msg in
                        HStack(alignment: .top) {
                            if msg.role == "user" { Spacer() }
                            Text("\(msg.role == \"user\" ? \"You\" : \"Assistant\"): \(msg.text)")
                                .padding(8)
                                .background(msg.role == "user" ? Color.blue.opacity(0.13) : Color.gray.opacity(0.18))
                                .cornerRadius(8)
                            if msg.role != "user" { Spacer() }
                        }
                    }
                }.padding()
            }
            if let error = error {
                Text(error)
                    .foregroundColor(.red)
                    .padding(4)
            }
            HStack {
                TextField("Say something...", text: $inputText)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .disabled(isLoading)
                Button(action: sendMessage) {
                    if isLoading {
                        ProgressView()
                    } else {
                        Text("Send")
                    }
                }.disabled(isLoading || inputText.isEmpty)
            }.padding()
        }
    }
    
    func sendMessage() {
        guard !inputText.isEmpty, !isLoading else { return }
        let userMessage = inputText
        messages.append((role: "user", text: userMessage))
        inputText = ""
        isLoading = true
        error = nil

        let conversationHistory = messages.map { $0.text }
        let req = MealAssistantRequest(
            user_message: userMessage,
            current_state: assistantState,
            conversation_history: conversationHistory,
            macro_context: nil  // For now, can be fetched or injected if available
        )
        BackendService.sendMealAssistant(request: req) { result in
            DispatchQueue.main.async {
                isLoading = false
                switch result {
                case .success(let resp):
                    messages.append((role: "assistant", text: resp.assistant_message))
                    assistantState = resp.next_state
                case .failure(let err):
                    error = "Send failed: \(err.localizedDescription)"
                }
            }
        }
    }
}

#Preview {
    LogChatView()
}
