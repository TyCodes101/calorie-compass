//
//  LogChatView.swift
//  CalorieCompass
//
//  Native chat logger main view for Phase 2A
//
import SwiftUI

struct LogChatView: View {
    @State private var messages: [String] = [] // Phase 2A: Stub, replace with models
    @State private var inputText = ""
    @State private var isLoading = false
    @State private var error: String?
    
    var body: some View {
        VStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(messages, id: \ .self) { message in
                        Text(message)
                            .padding(8)
                            .background(Color.gray.opacity(0.2))
                            .cornerRadius(8)
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
        messages.append("You: \(userMessage)")
        inputText = ""
        isLoading = true
        error = nil
        // Phase 2A: Replace with actual POST /api/meal-assistant using URLSession
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            // Fake backend echo
            messages.append("Assistant: Confirmed [simulated]")
            isLoading = false
        }
    }
}

#Preview {
    LogChatView()
}
