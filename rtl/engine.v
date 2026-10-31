`timescale 1ns/1ps
module engine #(
    parameter [31:0] FAIR = 10000,
    parameter [31:0] THRESHOLD = 5,
    parameter [15:0] MAX_ORDER = 20,
    parameter signed [31:0] LIMIT = 100
)(
    input wire clk, input wire rst,
    input wire in_valid, input wire [31:0] price,
    input wire [15:0] quantity, input wire kill,
    output reg out_valid, output reg signed [31:0] order,
    output reg signed [31:0] position, output reg killed
);
    reg signed [32:0] delta;
    reg signed [32:0] room;
    reg signed [32:0] amount;
    reg signed [31:0] next_order;
    always @* begin
        delta = $signed({1'b0, FAIR}) - $signed({1'b0, price});
        room = 0;
        amount = 0;
        next_order = 0;
        if (!killed && !kill) begin
            if (delta >= $signed({1'b0, THRESHOLD}))
                room = $signed({1'b0, LIMIT}) - $signed(position);
            else if (delta <= -$signed({1'b0, THRESHOLD}))
                room = $signed({1'b0, LIMIT}) + $signed(position);
            amount = {17'b0, quantity};
            if (amount > $signed({17'b0, MAX_ORDER})) amount = {17'b0, MAX_ORDER};
            if (amount > room) amount = room;
            // amount is capped by the 16-bit MAX_ORDER, so 32 bits retain it exactly.
            if (delta >= $signed({1'b0, THRESHOLD})) next_order = $signed(amount[31:0]);
            else if (delta <= -$signed({1'b0, THRESHOLD})) next_order = -$signed(amount[31:0]);
        end
    end
    always @(posedge clk) begin
        if (rst) begin
            position <= 0;
            killed <= 0;
            order <= 0;
            out_valid <= 0;
        end else begin
            out_valid <= in_valid;
            if (in_valid) begin
                order <= next_order;
                position <= position + next_order;
                killed <= killed | kill;
            end
        end
    end
endmodule

// Runtime-configured engine. Configuration is accepted only by the core before
// its first quote. The original parameterized engine above remains a test oracle.
module configured_engine(
    input wire clk, rst, in_valid,
    input wire [31:0] price, input wire [15:0] quantity, input wire kill,
    input wire [31:0] settings, input wire [15:0] max_order,
    output reg out_valid, output reg signed [31:0] order,
    output wire signed [31:0] position, output reg killed
);
    wire sma=settings[31];
    wire [2:0] shift=settings[30:28];
    wire [6:0] window_size=7'd1 << shift;
    wire [31:0] threshold={16'b0,settings[15:0]};
    wire signed [9:0] limit_value={3'b0,settings[22:16]};
    reg signed [8:0] held;
    assign position={{23{held[8]}},held};
    wire [15:0] capped_quantity=quantity>max_order ? max_order : quantity;
    reg [31:0] history [0:63];
    reg [5:0] head;
    reg [6:0] count;
    reg [37:0] sum;
    wire [37:0] average=sum >> shift;
    wire [31:0] fair=sma ? average[31:0] : 32'd10000;
    reg signed [32:0] delta;
    reg signed [9:0] room,amount;
    reg signed [8:0] next_order;
    always @* begin
        delta=$signed({1'b0,fair})-$signed({1'b0,price});
        room=0;amount=0;next_order=0;
        if (!killed && !kill && (!sma || count==window_size)) begin
            if(delta >= $signed({1'b0,threshold})) room=$signed(limit_value)-$signed(held);
            else if(delta <= -$signed({1'b0,threshold})) room=$signed(limit_value)+$signed(held);
            // Configured max_order <=20, so the clipped quantity fits five bits.
            amount={5'b0,capped_quantity[4:0]};
            if(amount>room) amount=room;
            if(delta >= $signed({1'b0,threshold})) next_order=amount[8:0];
            else if(delta <= -$signed({1'b0,threshold})) next_order=-$signed(amount[8:0]);
        end
    end
    always @(posedge clk) begin
        if(rst) begin
            out_valid<=0;order<=0;held<=0;killed<=0;head<=0;count<=0;sum<=0;
        end else begin
            out_valid<=in_valid;
            if(in_valid) begin
                order<={{23{next_order[8]}},next_order};held<=held+next_order;killed<=killed|kill;
                if(sma) begin
                    // Never read uninitialized history while warming up.
                    if(count<window_size) begin
                        sum<=sum+{6'b0,price};count<=count+7'd1;
                    end else sum<=sum-{6'b0,history[head]}+{6'b0,price};
                    history[head]<=price;
                    if({1'b0,head}==window_size-7'd1) head<=0;
                    else head<=head+6'd1;
                end
            end
        end
    end
endmodule
